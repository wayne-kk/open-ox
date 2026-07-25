import { describe, expect, it } from "vitest";
import {
  createFileSession,
  InMemoryFileSessionWorkspace,
} from "./fileSession";

function createSession() {
  const workspace = new InMemoryFileSessionWorkspace({
    "app/page.tsx": `export default function Home() { return <main>Preparing your site…</main>; }`,
  });
  const session = createFileSession({
    owner: "page:home",
    workspace,
    ownsPath: (path) => path === "app/page.tsx" || path.startsWith("components/pages/home/"),
    requiredArtifacts: ["app/page.tsx"],
    replaceableBaselinePaths: ["app/page.tsx"],
    validateArtifact: (path, content) =>
      path === "app/page.tsx" && content.includes("Preparing your site")
        ? "page is still the bootstrap stub"
        : null,
  });
  return { session, workspace };
}

describe("FileSession", () => {
  it("exposes canonical artifacts without leaking mutable session records", async () => {
    const session = createFileSession({
      owner: "test",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === "app/page.tsx",
      requiredArtifacts: ["app/page.tsx"],
    });
    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default function Page() { return null }" },
    });

    const artifacts = session.artifacts();
    expect(artifacts.get("app/page.tsx")).toEqual({
      content: "export default function Page() { return null }",
      revision: expect.stringMatching(/^sha256:/),
    });
    (artifacts as Map<string, unknown>).clear();
    expect(session.artifacts().has("app/page.tsx")).toBe(true);
  });

  it("loads an existing owned artifact without recording a mutation", async () => {
    const session = createFileSession({
      owner: "test",
      workspace: new InMemoryFileSessionWorkspace({
        "app/page.tsx": "export default function Existing() { return null }",
      }),
      ownsPath: (path) => path === "app/page.tsx",
      requiredArtifacts: ["app/page.tsx"],
    });

    expect(await session.loadIfExists("app/page.tsx")).toBe(true);
    expect(session.artifacts().has("app/page.tsx")).toBe(true);
    expect(session.writtenPaths()).toEqual([]);
    expect(session.events()).toEqual([
      expect.objectContaining({ kind: "file_loaded", path: "app/page.tsx" }),
    ]);
  });
  it("rejects malformed file commands before workspace access and permits recovery", async () => {
    const { session, workspace } = createSession();
    let mutationCalls = 0;
    const originalCreateOrReplace = workspace.createOrReplace.bind(workspace);
    workspace.createOrReplace = async (...args) => {
      mutationCalls += 1;
      return originalCreateOrReplace(...args);
    };

    const malformedCall = {
      name: "create_file",
      args: { path: "app/page.tsx", content: undefined },
    };
    const first = await session.execute(malformedCall);
    const second = await session.execute(malformedCall);

    expect(first).toMatchObject({
      success: false,
      code: "INVALID_ARGUMENT",
      path: "app/page.tsx",
      retryable: true,
      error: "create_file.content must be a string",
    });
    expect(second).toMatchObject({ success: false, code: "INVALID_ARGUMENT" });
    expect(mutationCalls).toBe(0);
    expect(session.stopDecision()).toMatchObject({ kind: "continue" });

    const recovered = await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: "export default function Home() { return <main>Ready</main>; }",
      },
    });

    expect(recovered).toMatchObject({ success: true, kind: "file_created" });
    expect(mutationCalls).toBe(1);
    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("stops after the bounded protocol failure budget with the original validation error", async () => {
    const { session } = createSession();
    const malformedCall = {
      name: "create_file",
      args: { path: "app/page.tsx", content: undefined },
    };

    await session.execute(malformedCall);
    await session.execute(malformedCall);
    const third = await session.execute(malformedCall);

    expect(third).toMatchObject({
      success: false,
      code: "INVALID_ARGUMENT",
      retryable: false,
    });
    expect(session.stopDecision()).toEqual({
      kind: "failed",
      error:
        "app/page.tsx failed 3 file command validation(s): INVALID_ARGUMENT: create_file.content must be a string",
    });
  });

  it("includes the original workspace exception in the terminal decision", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default function Home() { return null; }",
    });
    workspace.createOrReplace = async () => {
      throw new Error("disk quota exceeded");
    };
    const session = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === "app/page.tsx",
      requiredArtifacts: ["app/page.tsx"],
      replaceableBaselinePaths: ["app/page.tsx"],
    });
    const call = {
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default function Home() { return null; }" },
    };

    await session.execute(call);
    const second = await session.execute(call);

    expect(second).toMatchObject({ code: "WORKSPACE_ERROR", retryable: false });
    expect(session.stopDecision()).toEqual({
      kind: "failed",
      error:
        "app/page.tsx failed 2 consecutive file command(s): WORKSPACE_ERROR: disk quota exceeded; retryable=false",
    });
  });

  it("resets session-level protocol failures after any valid command", async () => {
    const { session } = createSession();
    const missingPath = { name: "read_file_snapshot", args: {} };

    await session.execute(missingPath);
    await session.execute(missingPath);
    await session.execute({
      name: "read_file_snapshot",
      args: { path: "app/page.tsx" },
    });
    const afterReset = await session.execute(missingPath);

    expect(afterReset).toMatchObject({
      code: "INVALID_ARGUMENT",
      retryable: true,
    });
    expect(session.stopDecision()).toMatchObject({ kind: "continue" });
  });

  it("rejects a reversed patch range before workspace access", async () => {
    const { session, workspace } = createSession();
    let patchCalls = 0;
    workspace.patch = async (...args) => {
      patchCalls += 1;
      return InMemoryFileSessionWorkspace.prototype.patch.apply(workspace, args);
    };

    const result = await session.execute({
      name: "apply_file_patch",
      args: {
        path: "app/page.tsx",
        baseRevision: "sha256:any",
        edits: [{
          range: {
            start: { line: 2, character: 0 },
            end: { line: 1, character: 0 },
          },
          newText: "replacement",
        }],
      },
    });

    expect(result).toMatchObject({
      code: "INVALID_ARGUMENT",
      error: "apply_file_patch.edits[0] range end must not precede range start",
    });
    expect(patchCalls).toBe(0);
  });

  it("evaluates completion validators against the current artifact revisions", async () => {
    const workspace = new InMemoryFileSessionWorkspace();
    const session = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === "app/page.tsx",
      requiredArtifacts: ["app/page.tsx"],
      validateCompletion: ({ artifacts }) =>
        artifacts.get("app/page.tsx")?.content ===
        "export default () => <img src='placeholder' />"
          ? "page still contains a placeholder"
          : null,
    });

    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default () => <img src='placeholder' />" },
    });
    expect(session.stopDecision()).toEqual({
      kind: "continue",
      reason: "page still contains a placeholder",
    });

    const snapshot = await session.execute({
      name: "read_file_snapshot",
      args: { path: "app/page.tsx" },
    });
    expect(session.stopDecision()).toEqual({
      kind: "continue",
      reason: "page still contains a placeholder",
    });
    await session.execute({
      name: "apply_file_patch",
      args: {
        path: "app/page.tsx",
        baseRevision: snapshot.revision!,
        edits: [{
          range: { start: { line: 0, character: 32 }, end: { line: 0, character: 43 } },
          newText: "/images/hero.png",
        }],
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("replaces a file atomically against a fresh snapshot revision", async () => {
    const { session, workspace } = createSession();
    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default () => <main>Old</main>" },
    });
    const blind = await session.execute({
      name: "replace_file",
      args: { path: "app/page.tsx", baseRevision: "sha256:stale", content: "new" },
    });
    expect(blind).toMatchObject({ success: false, code: "STALE_REVISION" });

    const snapshot = await session.execute({ name: "read_file_snapshot", args: { path: "app/page.tsx" } });
    const replaced = await session.execute({
      name: "replace_file",
      args: {
        path: "app/page.tsx",
        baseRevision: snapshot.revision!,
        content: "export default () => <main>New</main>",
      },
    });
    expect(replaced).toMatchObject({ success: true, kind: "file_updated" });
    expect((await workspace.read("app/page.tsx")).content).toContain("New");
  });

  it("excludes read-only records from completion validation", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default () => <main>Ready</main>",
      "components/pages/home/Legacy.tsx": "export const legacy = 'placeholder'",
    });
    const session = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === "app/page.tsx" || path.startsWith("components/pages/home/"),
      requiredArtifacts: ["app/page.tsx"],
      replaceableBaselinePaths: ["app/page.tsx"],
      validateCompletion: ({ artifacts }) =>
        [...artifacts.values()].some((artifact) => artifact.content.includes("placeholder"))
          ? "written source contains a placeholder"
          : null,
    });
    await session.execute({ name: "read_file_snapshot", args: { path: "components/pages/home/Legacy.tsx" } });
    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default () => <main>Ready</main>" },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("makes duplicate create delivery idempotent and rejects a different overwrite", async () => {
    const { session, workspace } = createSession();
    const call = {
      name: "create_file" as const,
      args: {
        path: "components/pages/home/Hero.tsx",
        content: "export function Hero() { return <h1>Hello</h1>; }",
      },
    };

    const created = await session.execute(call);
    const duplicate = await session.execute(call);
    const overwrite = await session.execute({
      name: "create_file",
      args: {
        ...call.args,
        content: "export function Hero() { return <h1>Changed</h1>; }",
      },
    });

    expect(created).toMatchObject({ success: true, kind: "file_created", cached: false });
    expect(duplicate).toMatchObject({ success: true, kind: "file_created", cached: true });
    expect(overwrite).toMatchObject({ success: false, code: "FILE_ALREADY_CREATED" });
    expect(await workspace.readText(call.args.path)).toContain("Hello");
    expect(session.events()).toHaveLength(1);
  });

  it("serializes concurrent creates so one path has exactly one mutation", async () => {
    const { session, workspace } = createSession();
    const [first, second] = await Promise.all([
      session.execute({
        name: "create_file",
        args: { path: "components/pages/home/Hero.tsx", content: "export const value = 1;" },
      }),
      session.execute({
        name: "create_file",
        args: { path: "components/pages/home/Hero.tsx", content: "export const value = 2;" },
      }),
    ]);

    expect([first.success, second.success].filter(Boolean)).toHaveLength(1);
    expect([first.code, second.code]).toContain("FILE_ALREADY_CREATED");
    expect(await workspace.readText("components/pages/home/Hero.tsx")).toContain("value = 1");
    expect(session.events()).toHaveLength(1);
  });

  it("turns repeated protocol failures into a terminal decision", async () => {
    const { session } = createSession();
    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 1" },
    });

    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 2" },
    });
    expect(session.stopDecision().kind).toBe("continue");
    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 3" },
    });

    expect(session.stopDecision()).toMatchObject({ kind: "failed" });
  });

  it("applies patches only to the current snapshot revision", async () => {
    const { session, workspace } = createSession();
    await session.execute({
      name: "create_file",
      args: {
        path: "components/pages/home/Hero.tsx",
        content: "export function Hero() { return <h1>Hello</h1>; }",
      },
    });
    await session.execute({
      name: "read_file_snapshot",
      args: { path: "components/pages/home/Hero.tsx" },
    });
    const edits = [
      {
        range: {
          start: { line: 0, character: 36 },
          end: { line: 0, character: 41 },
        },
        newText: "Welcome",
      },
    ];

    const stale = await session.execute({
      name: "apply_file_patch",
      args: {
        path: "components/pages/home/Hero.tsx",
        baseRevision: "sha256:stale",
        edits,
      },
    });
    const refreshed = await session.execute({
      name: "read_file_snapshot",
      args: { path: "components/pages/home/Hero.tsx" },
    });
    const updated = await session.execute({
      name: "apply_file_patch",
      args: {
        path: "components/pages/home/Hero.tsx",
        baseRevision: refreshed.revision!,
        edits,
      },
    });

    expect(stale).toMatchObject({ success: false, code: "STALE_REVISION" });
    expect(updated).toMatchObject({ success: true, kind: "file_updated" });
    expect(await workspace.readText("components/pages/home/Hero.tsx")).toContain("Welcome");
  });

  it("derives completion from required artifacts instead of a model completion call", async () => {
    const { session } = createSession();
    expect(session.stopDecision()).toMatchObject({ kind: "continue" });

    await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: "export default function Home() { return <main>Ready</main>; }",
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("rejects an unowned path without poisoning an otherwise complete session", async () => {
    const { session } = createSession();
    await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: "export default function Home() { return <main>Ready</main>; }",
      },
    });
    const result = await session.execute({
      name: "verify_files",
      args: { paths: ["app/layout.tsx"] },
    });

    expect(result).toMatchObject({
      success: false,
      code: "PATH_NOT_OWNED",
      retryable: true,
    });
    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("stops after repeated writes outside the ownership boundary", async () => {
    const { session } = createSession();
    const call = {
      name: "create_file",
      args: {
        path: "components/shared/MatchCard.tsx",
        content: "export function MatchCard() { return null; }",
      },
    };

    const first = await session.execute(call);
    const second = await session.execute(call);

    expect(first).toMatchObject({
      success: false,
      code: "PATH_NOT_OWNED",
      retryable: true,
    });
    expect(second).toMatchObject({
      success: false,
      code: "PATH_NOT_OWNED",
      retryable: false,
    });
    expect(session.stopDecision()).toEqual({
      kind: "failed",
      error:
        "components/shared/MatchCard.tsx failed 2 consecutive file command(s): PATH_NOT_OWNED: page:home does not own components/shared/MatchCard.tsx; retryable=false",
    });
  });
});
