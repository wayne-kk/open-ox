import { describe, expect, it, vi } from "vitest";
import type { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { InMemoryFileSessionWorkspace } from "@/ai/shared/fileSession/fileSession";

const loop = { call: vi.fn() };

import { runChromeBuildSession } from "./chromeBuildSession";

type ToolLoopParams = Parameters<typeof callLLMWithToolsFromMessages>[0];

class RecordingWorkspace extends InMemoryFileSessionWorkspace {
  verifiedPaths: string[] = [];

  override async verify(paths: string[]) {
    this.verifiedPaths = [...paths];
    return super.verify(paths);
  }
}

describe("runChromeBuildSession", () => {
  it("starts Scaffold with one runtime-bound layout creation command", async () => {
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(params.contextMode).toBe("managed");
      expect(params.parallelToolCalls).toBe(false);
      expect(params.resolveToolsForIteration?.(0, params.tools).map((tool) => tool.function.name))
        .toEqual(["create_chrome_layout"]);
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "scaffold",
      chromeForm: "none",
      initialMessages: [{ role: "system", content: "Build" }, { role: "user", content: "Chrome" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      workspace: new InMemoryFileSessionWorkspace(),
      langfusePhase: "chrome.scaffold",
    }, { runToolLoop: loop.call });

    expect(result.finalDecision).toEqual({
      kind: "continue",
      reason: "app/layout.tsx is missing",
    });
  });

  it("makes Scaffold create-once and requires a clean verification after its artifacts exist", async () => {
    const layout = "export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html> }";
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const outOfPhase = await params.executeToolOverrides.create_chrome_component({
        path: "components/chrome/Early.tsx",
        content: "export const Early = () => null",
      });
      expect(outOfPhase).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining("ILLEGAL_ACTION"),
      }));
      const first = await params.executeToolOverrides.create_chrome_layout({ content: layout });
      expect(first).toEqual(expect.objectContaining({ success: true }));
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual([
          "create_chrome_component",
          "read_chrome_file",
          "replace_chrome_file",
          "verify_chrome_files",
        ]);

      const repeated = await params.executeToolOverrides.create_chrome_layout({ content: layout });
      expect(repeated).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining("ILLEGAL_ACTION"),
      }));

      await params.executeToolOverrides.create_chrome_component({
        path: "components/chrome/Navigation.tsx",
        content: "export function Navigation() { return <nav /> }",
      });
      expect(params.resolveToolsForIteration?.(2, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_chrome_files"]);

      await params.executeToolOverrides.verify_chrome_files({});
      expect(params.resolveToolsForIteration?.(3, params.tools)).toEqual([]);
      expect(params.resolveTaskStateForRound?.().decisions).toContain("phase=complete");
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "scaffold",
      chromeForm: "top-nav",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      workspace: new InMemoryFileSessionWorkspace(),
      langfusePhase: "chrome.scaffold",
    }, { runToolLoop: loop.call });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.writtenPaths).toEqual([
      "app/layout.tsx",
      "components/chrome/Navigation.tsx",
    ]);
  });

  it("requires Scaffold to resolve an unspecified chrome form without a completion tool", async () => {
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const rejected = await params.executeToolOverrides.create_chrome_layout({ content: "valid" });
      expect(rejected).toEqual(expect.objectContaining({ success: false }));
      const rejectedWrite = await params.executeToolOverrides.create_chrome_layout({
        content: "",
        chromeForm: "top-nav",
      });
      expect(rejectedWrite).toEqual(expect.objectContaining({ success: false }));
      const accepted = await params.executeToolOverrides.create_chrome_layout({
        content: "export default function Layout({ children }: { children: React.ReactNode }) { return <html>{children}</html> }",
        chromeForm: "none",
      });
      expect(accepted.success).toBe(true);
      await params.executeToolOverrides.verify_chrome_files({});
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "scaffold",
      chromeForm: "unspecified",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      workspace: new InMemoryFileSessionWorkspace(),
      langfusePhase: "chrome.scaffold",
    }, { runToolLoop: loop.call });

    expect(result.chromeForm).toBe("none");
    expect(result.finalDecision).toEqual({ kind: "complete" });
  });

  it("adopts Optimize files, forbids creation, and verifies immediately after replacement", async () => {
    const initialLayout = "export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html> }";
    const workspace = new InMemoryFileSessionWorkspace({
      "app/layout.tsx": initialLayout,
      "components/chrome/Navigation.tsx": "export function Navigation() { return <nav /> }",
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const initialTools = params.resolveToolsForIteration?.(0, params.tools).map((tool) => tool.function.name);
      expect(initialTools).toEqual(["read_chrome_file", "replace_chrome_file", "verify_chrome_files"]);
      expect(initialTools).not.toContain("create_chrome_layout");
      expect(initialTools).not.toContain("create_chrome_component");
      expect(params.resolveTaskStateForRound?.().decisions).toContain(
        "ownership=app/layout.tsx, components/chrome/Navigation.tsx",
      );
      expect(params.resolveTaskStateForRound?.().decisions).not.toContain(
        "ownership=app/layout.tsx, components/chrome/**",
      );

      const snapshot = await params.executeToolOverrides.read_chrome_file({ path: "app/layout.tsx" });
      const revision = String(snapshot.meta?.revision);
      const stale = await params.executeToolOverrides.replace_chrome_file({
        path: "app/layout.tsx",
        baseRevision: "sha256:stale",
        content: initialLayout,
      });
      expect(stale).toEqual(expect.objectContaining({ success: false }));
      await params.executeToolOverrides.read_chrome_file({ path: "app/layout.tsx" });
      const replacement = await params.executeToolOverrides.replace_chrome_file({
        path: "app/layout.tsx",
        baseRevision: revision,
        content: initialLayout.replace("<body>", "<body className=\"optimized\">"),
      });
      expect(replacement.success).toBe(true);
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_chrome_files"]);
      const illegalRead = await params.executeToolOverrides.read_chrome_file({ path: "app/layout.tsx" });
      expect(illegalRead).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining("ILLEGAL_ACTION"),
      }));
      await params.executeToolOverrides.verify_chrome_files({});
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "optimize",
      chromeForm: "top-nav",
      initialMessages: [{ role: "user", content: "Polish" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      workspace,
      existingChromePaths: ["components/chrome/Navigation.tsx"],
      langfusePhase: "chrome.optimize",
    }, { runToolLoop: loop.call });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.writtenPaths).toEqual(["app/layout.tsx"]);
  });

  it("lets Optimize complete with a clean verification and no write", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/layout.tsx": "export default function Layout({ children }: { children: React.ReactNode }) { return <html>{children}</html> }",
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.verify_chrome_files({});
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "optimize",
      chromeForm: "none",
      initialMessages: [{ role: "user", content: "Polish" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      workspace,
      langfusePhase: "chrome.optimize",
    }, { runToolLoop: loop.call });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.writtenPaths).toEqual([]);
  });

  it("executes and verifies minimal Scaffold fallback inside the session Module", async () => {
    const fallback = "export default function Layout({ children }: { children: React.ReactNode }) { return <html>{children}</html> }";
    loop.call.mockResolvedValueOnce({ content: "", toolCalls: [] });
    const events: string[] = [];

    const result = await runChromeBuildSession({
      profile: "scaffold",
      chromeForm: "top-nav",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 1,
      workspace: new InMemoryFileSessionWorkspace(),
      fallbackLayoutContent: fallback,
      onEvent: (event) => {
        if (event.kind === "tool") events.push(event.name);
      },
      langfusePhase: "chrome.scaffold",
    }, { runToolLoop: loop.call });

    expect(result.fellBackToMinimal).toBe(true);
    expect(result.chromeForm).toBe("none");
    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.writtenPaths).toEqual(["app/layout.tsx"]);
    expect(events).toEqual(["create_chrome_layout", "verify_chrome_files"]);
  });

  it("preloads and verifies surveyed Scaffold components", async () => {
    const componentPath = "components/chrome/ExistingNav.tsx";
    const workspace = new RecordingWorkspace({
      [componentPath]: "export function ExistingNav() { return <nav /> }",
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_chrome_layout({
        content: "export default function Layout({ children }: { children: React.ReactNode }) { return <html>{children}</html> }",
      });
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_chrome_files"]);
      await params.executeToolOverrides.verify_chrome_files({});
      return { content: "", toolCalls: [] };
    });

    const result = await runChromeBuildSession({
      profile: "scaffold",
      chromeForm: "top-nav",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 4,
      workspace,
      existingChromePaths: [componentPath],
      langfusePhase: "chrome.scaffold",
    }, { runToolLoop: loop.call });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(workspace.verifiedPaths).toEqual([componentPath, "app/layout.tsx"]);
  });
});
