/**
 * Smoke test - validates the SDK can be imported and configured correctly.
 *
 * This test does NOT call real LLM APIs. It verifies:
 * - All exports are accessible
 * - Client can be instantiated
 * - Adapters can be created
 * - Type contracts are satisfied
 */

import { describe, it, expect } from "vitest";

describe("SDK smoke test", () => {
  it("exports OpenOxClient from main entry", async () => {
    const sdk = await import("../index");
    expect(sdk.OpenOxClient).toBeDefined();
    expect(typeof sdk.OpenOxClient).toBe("function");
  });

  it("exports server adapters from server entry", async () => {
    const server = await import("../server");
    expect(server.createNodeAdapters).toBeDefined();
    expect(server.NodeFileSystem).toBeDefined();
    expect(server.NodeShellExecutor).toBeDefined();
    expect(server.FilePromptLoader).toBeDefined();
    expect(server.createHttpServer).toBeDefined();
  });

  it("createNodeAdapters returns fileSystem and shellExecutor", async () => {
    const { createNodeAdapters } = await import("../adapters");
    const adapters = createNodeAdapters();
    expect(adapters.fileSystem).toBeDefined();
    expect(adapters.fileSystem.readFile).toBeDefined();
    expect(adapters.fileSystem.writeFile).toBeDefined();
    expect(adapters.fileSystem.exists).toBeDefined();
    expect(adapters.shellExecutor).toBeDefined();
    expect(adapters.shellExecutor.exec).toBeDefined();
  });

  it("client + adapters wire up correctly", async () => {
    const { OpenOxClient } = await import("../client");
    const { createNodeAdapters } = await import("../adapters");

    const client = new OpenOxClient({
      llm: {
        apiKey: "sk-test-not-real",
        model: "gpt-4o",
        stepModels: { analyze_project_requirement: "gpt-4o-mini" },
      },
      projectsRoot: "/tmp/sdk-smoke-test",
      ...createNodeAdapters(),
    });

    expect(client).toBeDefined();
    expect(client.getProjectPath("test-123")).toBe("/tmp/sdk-smoke-test/test-123");
  });

  it("FilePromptLoader satisfies PromptLoader interface", async () => {
    const { FilePromptLoader } = await import("../adapters/filePromptLoader");
    const loader = new FilePromptLoader("/tmp/prompts");

    // Verify interface methods exist
    expect(typeof loader.loadPrompt).toBe("function");
    expect(typeof loader.hasPrompt).toBe("function");
  });
});
