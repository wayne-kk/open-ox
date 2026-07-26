import { describe, expect, it, vi } from "vitest";
import {
  createFileSession,
  InMemoryFileSessionWorkspace,
} from "@/ai/shared/fileSession/fileSession";
import { createAgentWorkspaceRuntime } from "./agentWorkspaceRuntime";

function fixture(options: {
  initial?: Record<string, string>;
  invalidPrimary?: boolean;
  holdCompletion?: boolean;
  findings?: () => Array<{
    code: string;
    message: string;
    path?: string;
    blocking: boolean;
    resolution?: { kind: "external"; capability: string } | { kind: "edit"; path: string };
  }>;
  externalActions?: Record<string, (args: Record<string, unknown>) => Promise<{ success: boolean; output?: string }>>;
} = {}) {
  const primaryPath = "app/page.tsx";
  const componentRoot = "components/pages/home";
  const workspace = new InMemoryFileSessionWorkspace(options.initial);
  const fileSession = createFileSession({
    owner: "page:home",
    workspace,
    ownsPath: (path) => path === primaryPath || path.startsWith(`${componentRoot}/`),
    requiredArtifacts: [primaryPath],
    replaceableBaselinePaths: [primaryPath],
    ...(options.invalidPrimary
      ? { validateArtifact: (_path: string, content: string) => content.includes("Preparing your site") ? "default stub" : null }
      : {}),
    ...(options.holdCompletion ? { validateCompletion: () => "building" } : {}),
  });
  const runtime = createAgentWorkspaceRuntime({
    fileSession,
    profile: {
      primaryArtifact: {
        path: primaryPath,
        requireSessionWriteWhenInvalid: true,
        isValid: (content) => !content.includes("Preparing your site"),
      },
      inspectFindings: () => options.findings?.() ?? [],
    },
    externalActions: options.externalActions ?? {},
  });
  return { runtime, fileSession, workspace, primaryPath };
}

describe("AgentWorkspaceRuntime", () => {
  it("keeps an invalid loaded primary artifact in the create-primary capability", async () => {
    const { runtime, workspace, primaryPath } = fixture({
      initial: {
        "app/page.tsx": "export default () => <main>Preparing your site…</main>",
      },
      invalidPrimary: true,
    });

    await runtime.initialize();
    expect(runtime.plan().capabilities).toEqual([{ kind: "create_primary", path: primaryPath }]);

    await runtime.execute({
      kind: "create",
      path: primaryPath,
      content: "export default () => <main>Ready</main>",
    });
    expect((await workspace.read(primaryPath)).content).toContain("Ready");
    expect(runtime.plan().capabilities).toEqual([{ kind: "verify" }]);
  });

  it("normalizes create for an existing artifact into a snapshot and focused edit", async () => {
    const componentPath = "components/pages/home/Hero.tsx";
    const { runtime, workspace } = fixture({
      initial: {
        "app/page.tsx": "export default () => <main>Ready</main>",
        [componentPath]: "export function Hero() { return null }",
      },
      holdCompletion: true,
    });
    await runtime.initialize();
    await runtime.execute({ kind: "verify" });

    const adopted = await runtime.execute({
      kind: "create",
      path: componentPath,
      content: "export function Hero() { return <section /> }",
    });
    expect((await workspace.read(componentPath)).content).toBe(
      "export function Hero() { return null }",
    );
    expect(adopted).toMatchObject({
      success: true,
      meta: { code: "EXISTING_ARTIFACT", path: componentPath, revision: expect.stringMatching(/^sha256:/) },
    });
    expect(runtime.plan().capabilities).toEqual([{ kind: "edit", path: componentPath }]);
  });

  it("exposes only the external capability for a blocking finding", async () => {
    let generated = false;
    const generate = vi.fn(async () => {
      generated = true;
      return { success: true, output: "/images/home-hero.png" };
    });
    const { runtime } = fixture({
      initial: { "app/page.tsx": "export default () => <img src=\"/images/home-hero.png\" />" },
      findings: () => generated ? [] : [{
        code: "MISSING_LOCAL_ASSET",
        message: "missing /images/home-hero.png",
        path: "app/page.tsx",
        blocking: true,
        resolution: { kind: "external", capability: "generate_image" },
      }],
      externalActions: { generate_image: generate },
    });
    await runtime.initialize();

    expect(runtime.plan().capabilities).toEqual([{ kind: "external", capability: "generate_image" }]);
    await runtime.execute({ kind: "external", capability: "generate_image", args: { prompt: "hero" } });
    expect(generate).toHaveBeenCalledWith({ prompt: "hero" });
    expect(runtime.plan().capabilities).toEqual([{ kind: "verify" }]);
    await runtime.execute({ kind: "verify" });
    expect(runtime.plan().decision).toEqual({ kind: "complete" });
  });

  it("never returns continue without at least one capability", async () => {
    const { runtime } = fixture();
    await runtime.initialize();
    const plan = runtime.plan();
    expect(plan.decision.kind).toBe("continue");
    expect(plan.capabilities.length).toBeGreaterThan(0);
  });

  it("prioritizes a fresh read after a stale edit", async () => {
    const { runtime, primaryPath } = fixture({
      initial: { "app/page.tsx": "export default () => <main>Ready</main>" },
      holdCompletion: true,
    });
    await runtime.initialize();
    const snapshot = await runtime.execute({ kind: "read", path: primaryPath });
    expect(typeof snapshot).toBe("object");
    await runtime.execute({
      kind: "edit",
      path: primaryPath,
      baseRevision: "sha256:stale",
      oldText: "Ready",
      newText: "Updated",
    });

    expect(runtime.plan().capabilities).toEqual([{ kind: "read", path: primaryPath }]);
    const refreshed = await runtime.execute({ kind: "read", path: primaryPath });
    expect(refreshed).toMatchObject({ success: true });
    expect(runtime.plan().capabilities).toEqual([{ kind: "edit", path: primaryPath }]);
  });

  it("rejects an intent that is absent from the current capability plan", async () => {
    const { runtime, primaryPath } = fixture({
      initial: { ["app/page.tsx"]: "export default () => <main>Ready</main>" },
    });
    await runtime.initialize();

    expect(await runtime.execute({ kind: "read", path: primaryPath })).toMatchObject({
      success: false,
      meta: { code: "ILLEGAL_CAPABILITY" },
    });
  });

  it("fails fast when a blocking finding has no resolution", async () => {
    const { runtime } = fixture({
      initial: { "app/page.tsx": "export default () => <main>Ready</main>" },
      findings: () => [{
        code: "IMPOSSIBLE_REQUIREMENT",
        message: "no action can resolve this",
        blocking: true,
      }],
    });
    await runtime.initialize();

    expect(runtime.plan()).toMatchObject({
      decision: { kind: "failed", error: expect.stringContaining("UNRESOLVABLE_FINDING") },
      capabilities: [],
    });
  });

  it("fails fast when an edit finding does not target an owned, loaded artifact", async () => {
    const { runtime } = fixture({
      initial: { "app/page.tsx": "export default () => <main>Ready</main>" },
      findings: () => [{
        code: "BROKEN_REFERENCE",
        message: "repair an unavailable file",
        blocking: true,
        resolution: { kind: "edit", path: "outside/page.tsx" },
      }],
    });
    await runtime.initialize();

    expect(runtime.plan()).toMatchObject({
      decision: { kind: "failed", error: expect.stringContaining("UNRESOLVABLE_EDIT_FINDING") },
      capabilities: [],
    });
  });
});
