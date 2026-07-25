import { describe, expect, it, vi } from "vitest";
import type { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";

const loop = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/shared/llm/toolLoop", () => ({ callLLMWithToolsFromMessages: loop.call }));

import { createFileSession, InMemoryFileSessionWorkspace } from "@/ai/shared/fileSession/fileSession";
import { runPageBuildSession } from "./pageBuildSession";

type ToolLoopParams = Parameters<typeof callLLMWithToolsFromMessages>[0];

describe("runPageBuildSession", () => {
  it("enforces target-first tools and opens the build phase only after the target write", async () => {
    const targetPath = "app/page.tsx";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath || path.startsWith("components/pages/home/"),
      requiredArtifacts: [targetPath],
      validateCompletion: () => "continue building",
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(params.contextMode).toBe("managed");
      expect(params.resolveToolsForIteration?.(0, params.tools).map((tool) => tool.function.name))
        .toEqual(["create_target_page"]);
      const result = await params.executeToolOverrides.create_target_page({
        content: "export default function Page() { return <main /> }",
      });
      expect(result.success).toBe(true);
      params.compactMessagesBeforeRound({
        iteration: 1,
        maxIterations: 8,
        messages: params.messages,
      });
      expect(params.messages.at(-1)).toMatchObject({ role: "user" });
      expect(params.messages.at(-1)?.content).toContain(`written_paths: ${targetPath}`);
      expect(params.messages.at(-1)?.content).not.toContain("target_revision: missing");
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["create_page_component", "read_page_file", "replace_page_file", "verify_page_files"]);
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home", targetPath, componentRoot: "components/pages/home",
      initialMessages: [{ role: "system", content: "Build" }, { role: "user", content: "Home" }],
      model: "gemini-3.6-flash", maxIterations: 8, fileSession, langfusePhase: "page.home",
    });
    expect(result.finalDecision).toEqual({ kind: "continue", reason: "continue building" });
    expect(fileSession.writtenPaths()).toEqual([targetPath]);
  });
});
