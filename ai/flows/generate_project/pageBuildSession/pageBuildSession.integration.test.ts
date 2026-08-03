import { describe, expect, it, vi } from "vitest";
import type { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";

const loop = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/shared/llm/toolLoop", () => ({
  callLLMWithToolsFromMessages: loop.call,
}));

import {
  createFileSession,
  InMemoryFileSessionWorkspace,
} from "@/ai/shared/fileSession/fileSession";
import { runPageBuildSession } from "./pageBuildSession";

type ToolLoopParams = Parameters<typeof callLLMWithToolsFromMessages>[0];

describe("runPageBuildSession", () => {
  it("defers page verification to the project-level repair pipeline", async () => {
    const targetPath = "app/page.tsx";
    const componentRoot = "components/pages/home";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath || path.startsWith(`${componentRoot}/`),
      requiredArtifacts: [targetPath],
    });

    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(params.tools.map((tool) => tool.function.name)).not.toContain("verify_page_files");
      await params.executeToolOverrides.create_page_file({
        path: `${componentRoot}/Hero.tsx`,
        content: "export default function Hero() { return <section>Hero</section> }",
      });
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: [
          'import Hero from "@/components/pages/home/Hero";',
          "export default function Page() { return <main><Hero /></main> }",
        ].join("\n"),
      });
      const completionTools = params
        .resolveToolsForIteration?.(2, params.tools)
        .map((tool) => tool.function.name);
      expect(completionTools).not.toContain("verify_page_files");
      expect(completionTools).toContain("page_implementation_complete");
      const completion = await params.executeToolOverrides.page_implementation_complete({ summary: "generated" });
      expect(completion.success).toBe(true);
      return { content: "generated", toolCalls: [] };
    });

    const result = await runPageBuildSession({
      slug: "home",
      targetPath,
      componentRoot,
      initialMessages: [{ role: "user", content: "Build" }],
      model: "gemini-3.6-flash",
      maxIterations: 4,
      fileSession,
      explicitCompletion: true,
      deferVerification: true,
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.finalLegalTools).not.toContain("verify_page_files");
  });

  it("lets the page agent create owned files without declaring or sequencing a component graph", async () => {
    const targetPath = "app/page.tsx";
    const componentPath = "components/pages/home/Hero.tsx";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace({
        [targetPath]:
          "export default function Page() { return <main>Preparing your site…</main> }",
      }),
      ownsPath: (path) =>
        path === targetPath || path.startsWith("components/pages/home/"),
      requiredArtifacts: [targetPath],
      replaceableBaselinePaths: [targetPath],
      validateArtifact: (path, content) =>
        path === targetPath && content.includes("Preparing your site")
          ? "default stub"
          : null,
    });

    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const initialTools = params
        .resolveToolsForIteration?.(0, params.tools)
        .map((tool) => tool.function.name);
      expect(initialTools).toEqual(
        expect.arrayContaining([
          "create_page_file",
          "read_page_file",
          "edit_page_file",
          "verify_page_files",
        ]),
      );
      expect(initialTools).not.toContain("declare_page_components");
      expect(initialTools).not.toContain("create_page_component");
      expect(initialTools).not.toContain("create_target_page");
      await params.executeToolOverrides.create_page_file({
        path: componentPath,
        content:
          "export default function Hero() { return <section>Hero</section> }",
      });
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: [
          'import Hero from "@/components/pages/home/Hero";',
          "export default function Page() { return <main><Hero /></main> }",
        ].join("\n"),
      });
      expect(
        params.resolveToolsForIteration?.(2, params.tools).map((tool) => tool.function.name),
      ).toEqual(expect.arrayContaining(["create_page_file", "verify_page_files"]));
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
      explicitCompletion: true,
      isPrimaryArtifactValid: (content) =>
        !content.includes("Preparing your site"),
      langfusePhase: "page.home",
    });
  });

  it("requires the final target to assemble a page-local component", async () => {
    const targetPath = "app/page.tsx";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath || path.startsWith("components/pages/home/"),
      requiredArtifacts: [targetPath],
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: "export default function Page() { return <main>All implementation inline</main> }",
      });
      await params.executeToolOverrides.verify_page_files({});
      expect(params.resolveToolsForIteration?.(2, params.tools).map((tool) => tool.function.name)).not.toContain(
        "page_implementation_complete",
      );
      const completion = await params.executeToolOverrides.page_implementation_complete({ summary: "done" });
      expect(completion).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("page-local component"),
        }),
      );
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
      explicitCompletion: true,
      langfusePhase: "page.home",
    });
    expect(result.finalDecision.kind).not.toBe("complete");
  });

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
      function: {
        name: "generate_image",
        parameters: { type: "object", properties: {} },
      },
    };
    let generatedPath: string | null = null;
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: `export default () => <img src="${placeholder}" />`,
      });
      const history: ToolLoopParams["messages"] = [];
      expect(
        params.onAssistantStop?.({
          iteration: 15,
          message: { role: "assistant", content: "" },
          messages: history,
        }),
      ).toBe(true);
      expect(history.at(-1)?.content).toContain(`"path":"${targetPath}"`);
      expect(history.at(-1)?.content).toContain(`"reference":"${placeholder}"`);
      expect(history.at(-1)?.content).toContain(
        '"nextAction":"generate_asset"',
      );
      expect(history.at(-1)?.content).toContain("legal_tools: generate_image");
      expect(
        params.onAssistantStop?.({
          iteration: 16,
          message: { role: "assistant", content: "" },
          messages: history,
        }),
      ).toBe(true);
      expect(
        params.onAssistantStop?.({
          iteration: 17,
          message: { role: "assistant", content: "" },
          messages: history,
        }),
      ).toBe(false);
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
        inspect: (artifacts) =>
          artifacts.get(targetPath)?.content.includes(placeholder)
            ? [
                {
                  kind: "asset_reference",
                  path: targetPath,
                  reference: placeholder,
                  nextAction: generatedPath ? "edit_source" : "generate_asset",
                  ...(generatedPath ? { replacement: generatedPath } : {}),
                },
              ]
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

  it("recovers an edit-ready asset finding without issuing an illegal read", async () => {
    const targetPath = "app/page.tsx";
    const placeholder = "https://images.unsplash.com/photo.jpg";
    const replacement = "/images/video-cover-1.png";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: `export default () => <img src="${placeholder}" />`,
      });
      await params.executeToolOverrides.read_page_file({ path: targetPath });
      expect(
        params
          .resolveToolsForIteration?.(2, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["edit_page_file"]);
      const history: ToolLoopParams["messages"] = [];
      params.onAssistantStop?.({
        iteration: 2,
        message: { role: "assistant", content: "" },
        messages: history,
      });
      params.onAssistantStop?.({
        iteration: 3,
        message: { role: "assistant", content: "" },
        messages: history,
      });
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
        inspect: (artifacts) =>
          artifacts.get(targetPath)?.content.includes(placeholder)
            ? [
                {
                  kind: "asset_reference",
                  path: targetPath,
                  reference: placeholder,
                  nextAction: "edit_source",
                  replacement,
                },
              ]
            : [],
      },
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.deterministicRecoveries).toBe(2);
    expect(fileSession.snapshot().artifacts.get(targetPath)?.content).toContain(
      replacement,
    );
  });

  it("adopts an existing target through edit semantics instead of exposing create", async () => {
    const targetPath = "app/page.tsx";
    const existing =
      "export default function Page() { return <main>BROKEN</main> }";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace({ [targetPath]: existing }),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(
        params
          .resolveToolsForIteration?.(0, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["verify_page_files"]);
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
    expect(
      fileSession
        .events()
        .filter((event) => event.code === "FILE_ALREADY_EXISTS"),
    ).toEqual([]);
    expect(result.finalDecision).toEqual({ kind: "complete" });
  });

  it("keeps a loaded default stub in draft_target and replaces it through create_page_file", async () => {
    const targetPath = "app/page.tsx";
    const stub =
      "export default function Page() { return <main>Preparing your site…</main> }";
    const implemented =
      "export default function Page() { return <main>Ready</main> }";
    const workspace = new InMemoryFileSessionWorkspace({ [targetPath]: stub });
    const fileSession = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
      replaceableBaselinePaths: [targetPath],
      validateArtifact: (_path, content) =>
        content.includes("Preparing your site") ? "default stub" : null,
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      expect(
        params
          .resolveToolsForIteration?.(0, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(
        expect.arrayContaining([
          "create_page_file",
          "read_page_file",
          "edit_page_file",
          "verify_page_files",
        ]),
      );
      const created = await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: implemented,
      });
      expect(created.success).toBe(true);
      expect(
        params
          .resolveToolsForIteration?.(1, params.tools)
          .map((tool) => tool.function.name),
      ).toContain("verify_page_files");
      await params.executeToolOverrides.verify_page_files({});
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

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(fileSession.writtenPaths()).toContain(targetPath);
    expect((await workspace.read(targetPath)).content).toBe(implemented);
    expect(
      fileSession
        .events()
        .filter((event) => event.code === "FILE_ALREADY_CREATED"),
    ).toEqual([]);
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
      ownsPath: (path) =>
        path === targetPath || path.startsWith("components/pages/home/"),
      requiredArtifacts: [targetPath],
      validateCompletion: () => (holdCompletion ? "building" : null),
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: "export default function Page() { return <main /> }",
      });
      await params.executeToolOverrides.verify_page_files({});
      expect(await fileSession.loadIfExists(componentPath)).toBe(true);
      holdCompletion = false;
      expect(
        params
          .resolveToolsForIteration?.(1, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["verify_page_files"]);
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
      function: {
        name: "generate_image",
        parameters: { type: "object", properties: {} },
      },
    };
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      const source = `export default function Page() { return <img src="${placeholder}" /> }`;
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: source,
      });
      expect(
        params
          .resolveToolsForIteration?.(1, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["generate_image"]);
      expect(params.resolveTaskStateForRound?.().decisions).toContainEqual(
        expect.stringContaining('"nextAction":"generate_asset"'),
      );

      const duplicate = await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: source,
      });
      expect(duplicate).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("ILLEGAL_CAPABILITY"),
        }),
      );

      await params.executeToolOverrides.generate_image({});
      expect(
        params
          .resolveToolsForIteration?.(2, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["read_page_file"]);
      const wrongSnapshot = await params.executeToolOverrides.read_page_file({
        path: "components/pages/home/Other.tsx",
      });
      expect(wrongSnapshot).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("ILLEGAL_CAPABILITY"),
        }),
      );
      let snapshot = await params.executeToolOverrides.read_page_file({
        path: targetPath,
      });
      expect(
        params
          .resolveToolsForIteration?.(3, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["edit_page_file"]);
      await params.executeToolOverrides.edit_page_file({
        path: targetPath,
        baseRevision: "sha256:stale",
        oldText: placeholder,
        newText: generatedPath!,
      });
      expect(
        params
          .resolveToolsForIteration?.(4, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["read_page_file"]);
      snapshot = await params.executeToolOverrides.read_page_file({
        path: targetPath,
      });
      await params.executeToolOverrides.edit_page_file({
        path: targetPath,
        baseRevision: snapshot.meta?.revision,
        oldText: placeholder,
        newText: generatedPath!,
      });
      expect(
        params
          .resolveToolsForIteration?.(5, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["verify_page_files"]);
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
            ? [
                {
                  kind: "asset_reference" as const,
                  path: targetPath,
                  reference: placeholder,
                  nextAction: generatedPath
                    ? ("edit_source" as const)
                    : ("generate_asset" as const),
                },
              ]
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
    expect(
      fileSession
        .events()
        .filter((event) => event.code === "FILE_ALREADY_CREATED"),
    ).toEqual([]);
  });

  it("generates a local image at its stable path without editing source", async () => {
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
      function: {
        name: "generate_image",
        parameters: { type: "object", properties: {} },
      },
    };

    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: source,
      });
      expect(
        params
          .resolveToolsForIteration?.(1, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["generate_image"]);
      await params.executeToolOverrides.generate_image({
        filename: "model-chosen-name",
        prompt: "A precise editorial hero image",
      });
      expect(generationArgs).toMatchObject({ filename: "home-hero" });
      expect(
        params
          .resolveToolsForIteration?.(2, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["verify_page_files"]);
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
        inspect: (artifacts) =>
          generated || !artifacts.has(targetPath)
            ? []
            : [
                {
                  kind: "asset_reference",
                  path: targetPath,
                  reference: imagePath,
                  nextAction: "generate_asset",
                },
              ],
        generation: {
          tool: imageTool,
          execute: async (args) => {
            generationArgs = args;
            generated = true;
            return {
              success: true,
              output: imagePath,
              meta: { path: imagePath },
            };
          },
        },
      },
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(fileSession.artifacts().get(targetPath)?.content).toBe(source);
    expect(
      fileSession
        .events()
        .filter(
          (event) =>
            event.kind === "file_snapshot" || event.kind === "file_updated",
        ),
    ).toEqual([]);
  });

  it("does not turn an unverifiable runtime image binding into a blocking edit", async () => {
    const targetPath = "app/page.tsx";
    const source =
      "export default ({ item }) => <img src={item.product.image} />";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new InMemoryFileSessionWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
    });
    loop.call.mockImplementationOnce(async (params: ToolLoopParams) => {
      await params.executeToolOverrides.create_page_file({
        path: targetPath,
        content: source,
      });
      expect(
        params
          .resolveToolsForIteration?.(1, params.tools)
          .map((tool) => tool.function.name),
      ).toEqual(["verify_page_files"]);
      await params.executeToolOverrides.verify_page_files({});
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
      assetLifecycle: {
        inspect: () => [
          {
            kind: "source_diagnostic",
            path: targetPath,
            message: "item.product.image cannot be verified statically",
          },
        ],
      },
      langfusePhase: "page.home",
    });

    expect(result.finalDecision).toEqual({ kind: "complete" });
    expect(result.finalRequirement).toBeUndefined();
    expect(result.finalLegalTools).toEqual([]);
  });
});
