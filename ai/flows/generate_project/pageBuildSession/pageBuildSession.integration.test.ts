import { describe, expect, it, vi } from "vitest";
import type { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";

const loop = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/shared/llm/toolLoop", () => ({ callLLMWithToolsFromMessages: loop.call }));

import { createFileSession, InMemoryFileSessionWorkspace } from "@/ai/shared/fileSession/fileSession";
import { runPageBuildSession } from "./pageBuildSession";

type ToolLoopParams = Parameters<typeof callLLMWithToolsFromMessages>[0];

describe("runPageBuildSession", () => {
  it("recovers an empty stop with the exact requirement and legal command", async () => {
    const targetPath = "app/page.tsx";
    const placeholder = "https://images.unsplash.com/hero.jpg";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    const imageTool = {
      type: "function" as const,
      function: { name: "generate_image", parameters: { type: "object", properties: {} } },
    };
    let generatedPath: string | null = null;
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_target_page({
        content: `export default () => <img src="${placeholder}" />`,
      });
      const history: ToolLoopParams["messages"] = [];
      expect(params.onAssistantStop?.({
        iteration: 15,
        message: { role: "assistant", content: "" },
        messages: history,
      })).toBe(true);
      expect(history.at(-1)?.content).toContain(`"path":"${targetPath}"`);
      expect(history.at(-1)?.content).toContain(`"reference":"${placeholder}"`);
      expect(history.at(-1)?.content).toContain('"nextAction":"generate_asset"');
      expect(history.at(-1)?.content).toContain("legal_tools: generate_image");
      expect(params.onAssistantStop?.({
        iteration: 16,
        message: { role: "assistant", content: "" },
        messages: history,
      })).toBe(true);
      expect(params.onAssistantStop?.({
        iteration: 17,
        message: { role: "assistant", content: "" },
        messages: history,
      })).toBe(false);
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot: "components/pages/home",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 96,
      fileSession,
      assetLifecycle: {
        inspect: (artifacts) => artifacts.get(targetPath)?.content.includes(placeholder)
          ? [{
              kind: "asset_reference",
              path: targetPath,
              reference: placeholder,
              nextAction: generatedPath ? "edit_source" : "generate_asset",
              ...(generatedPath ? { replacement: generatedPath } : {}),
            }]
          : [],
        generation: {
          tool: imageTool,
          execute: async () => {
            generatedPath = "/images/hero.png";
            return { success: true, output: generatedPath };
          },
        },
      },
      langfusePhase: "page.home",
    });
    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.finalRequirement).toBeUndefined();
    expect(result.finalLegalTools).toEqual([]);
    expect(result.deterministicRecoveries).toBe(3);
  });

  it("adopts an existing target through edit semantics instead of exposing create", async () => {
    const targetPath = "app/page.tsx";
    const existing = "export default function Page() { return <main>BROKEN</main> }";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace({ [targetPath]: existing }),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(params.resolveToolsForIteration?.(0, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_page_files"]);
      await params.executeToolOverrides.verify_page_files({});
      expect(params.resolveToolsForIteration?.(1, params.tools)).toEqual([]);
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot: "components/pages/home",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 4,
      fileSession,
      langfusePhase: "page.home",
    });
    expect(fileSession.events().filter((event) => event.code === "FILE_ALREADY_EXISTS"))
      .toEqual([]);
    expect(result.finalDecision).toEqual({ kind: "complete" });
  });

  it("enforces target-first tools and opens the build phase only after the target write", async () => {
    const targetPath = "app/page.tsx";
    const existingComponent = "components/pages/home/Existing.tsx";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace({
        [existingComponent]: "export function Existing() { return null }",
      }),
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
      expect(params.resolveTaskStateForRound?.().targetPaths).toEqual([targetPath]);
      expect(params.resolveTaskStateForRound?.().mutations).toEqual([
        expect.objectContaining({ path: targetPath, revision: expect.stringMatching(/^sha256:/) }),
      ]);
      expect(params.resolveTaskStateForRound?.().decisions).toContain("phase=build");
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["create_page_component", "read_page_file", "edit_page_file", "verify_page_files"]);
      const duplicateComponent = await params.executeToolOverrides.create_page_component({
        path: existingComponent,
        content: "export function Existing() { return <div /> }",
      });
      expect(duplicateComponent).toEqual(expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ code: "EXISTING_ARTIFACT", retryable: true }),
      }));
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home", targetPath, componentRoot: "components/pages/home",
      initialMessages: [{ role: "system", content: "Build" }, { role: "user", content: "Home" }],
      model: "gemini-3.6-flash", maxIterations: 8, fileSession, langfusePhase: "page.home",
    });
    expect(result.finalDecision).toEqual({ kind: "continue", reason: "continue building" });
    expect(fileSession.writtenPaths()).toEqual([targetPath]);
    expect(fileSession.events().filter((event) => event.code === "FILE_ALREADY_EXISTS"))
      .toEqual([]);
  });

  it("requires verification when presence discovery adopts an existing component", async () => {
    const targetPath = "app/page.tsx";
    const componentPath = "components/pages/home/Existing.tsx";
    let holdCompletion = true;
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace({
        [componentPath]: "export function Existing() { return null }",
      }),
      ownsPath: (path) => path === targetPath || path.startsWith("components/pages/home/"),
      requiredArtifacts: [targetPath],
      validateCompletion: () => holdCompletion ? "building" : null,
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_target_page({
        content: "export default function Page() { return <main /> }",
      });
      await params.executeToolOverrides.verify_page_files({});
      expect(await fileSession.loadIfExists(componentPath)).toBe(true);
      holdCompletion = false;
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_page_files"]);
      return { content: "", toolCalls: [] };
    });

    await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot: "components/pages/home",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 4,
      fileSession,
      langfusePhase: "page.home",
    });
  });

  it("transitions an existing page from asset requirement through edit and verification", async () => {
    const targetPath = "app/page.tsx";
    const placeholder = "https://images.unsplash.com/placeholder.jpg";
    let generatedPath: string | null = null;
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
      validateCompletion: ({ artifacts }) =>
        artifacts.get(targetPath)?.content.includes(placeholder)
          ? "asset replacement pending"
          : null,
    });
    const imageTool = {
      type: "function" as const,
      function: { name: "generate_image", parameters: { type: "object", properties: {} } },
    };
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const source = `export default function Page() { return <img src="${placeholder}" /> }`;
      await params.executeToolOverrides.create_target_page({ content: source });
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["generate_image"]);
      expect(params.resolveTaskStateForRound?.().decisions).toContainEqual(
        expect.stringContaining('"nextAction":"generate_asset"'),
      );

      const duplicate = await params.executeToolOverrides.create_target_page({ content: source });
      expect(duplicate).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining("ILLEGAL_LIFECYCLE_COMMAND"),
      }));

      await params.executeToolOverrides.generate_image({});
      expect(params.resolveToolsForIteration?.(2, params.tools).map((tool) => tool.function.name))
        .toEqual(["read_page_file"]);
      const wrongSnapshot = await params.executeToolOverrides.read_page_file({
        path: "components/pages/home/Other.tsx",
      });
      expect(wrongSnapshot).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining("ILLEGAL_LIFECYCLE_COMMAND"),
      }));
      let snapshot = await params.executeToolOverrides.read_page_file({ path: targetPath });
      expect(params.resolveToolsForIteration?.(3, params.tools).map((tool) => tool.function.name))
        .toEqual(["edit_page_file"]);
      await params.executeToolOverrides.edit_page_file({
        path: targetPath,
        baseRevision: "sha256:stale",
        oldText: placeholder,
        newText: generatedPath!,
      });
      expect(params.resolveToolsForIteration?.(4, params.tools).map((tool) => tool.function.name))
        .toEqual(["read_page_file"]);
      snapshot = await params.executeToolOverrides.read_page_file({ path: targetPath });
      await params.executeToolOverrides.edit_page_file({
        path: targetPath,
        baseRevision: snapshot.meta?.revision,
        oldText: placeholder,
        newText: generatedPath!,
      });
      expect(params.resolveToolsForIteration?.(5, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_page_files"]);
      await params.executeToolOverrides.verify_page_files({ paths: [] });
      expect(params.resolveToolsForIteration?.(6, params.tools)).toEqual([]);
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot: "components/pages/home",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 8,
      fileSession,
      assetLifecycle: {
        inspect: (artifacts) => {
          const source = artifacts.get(targetPath)?.content ?? "";
          return source.includes(placeholder)
            ? [{
                kind: "asset_reference" as const,
                path: targetPath,
                reference: placeholder,
                nextAction: generatedPath ? "edit_source" as const : "generate_asset" as const,
              }]
            : [];
        },
        generation: {
          tool: imageTool,
          execute: async () => {
            generatedPath = "/images/page-home-hero.png";
            return { success: true, output: generatedPath };
          },
        },
      },
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(fileSession.events().filter((event) => event.code === "FILE_ALREADY_CREATED"))
      .toEqual([]);
  });

  it("generates a declared local image at its stable path without editing source", async () => {
    const targetPath = "app/page.tsx";
    const imagePath = "/images/home-hero.png";
    const source = `export default function Page() { return <img src="${imagePath}" /> }`;
    let generated = false;
    let generationArgs: Record<string, unknown> | undefined;
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    const imageTool = {
      type: "function" as const,
      function: { name: "generate_image", parameters: { type: "object", properties: {} } },
    };

    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_target_page({ content: source });
      expect(params.resolveToolsForIteration?.(1, params.tools).map((tool) => tool.function.name))
        .toEqual(["generate_image"]);
      await params.executeToolOverrides.generate_image({
        filename: "model-chosen-name",
        prompt: "A precise editorial hero image",
      });
      expect(generationArgs).toMatchObject({ filename: "home-hero" });
      expect(params.resolveToolsForIteration?.(2, params.tools).map((tool) => tool.function.name))
        .toEqual(["verify_page_files"]);
      await params.executeToolOverrides.verify_page_files({});
      return { content: "", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot: "components/pages/home",
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 6,
      fileSession,
      assetLifecycle: {
        inspect: () => generated ? [] : [{
          kind: "asset_reference",
          path: targetPath,
          reference: imagePath,
          nextAction: "generate_asset",
        }],
        generation: {
          tool: imageTool,
          execute: async (args) => {
            generationArgs = args;
            generated = true;
            return { success: true, output: imagePath, meta: { path: imagePath } };
          },
        },
      },
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(fileSession.artifacts().get(targetPath)?.content).toBe(source);
    expect(fileSession.events().filter((event) =>
      event.kind === "file_snapshot" || event.kind === "file_updated"
    )).toEqual([]);
  });
});
