/**
 * GET /api/sdk-test
 *
 * Tests that @open-ox/sdk can be imported and configured correctly.
 * No LLM calls — just validates the package is usable.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, { passed: boolean; detail: string }> = {};

  // Test 1: Can we import the main entry?
  try {
    const sdk = await import("@open-ox/sdk");
    results.importTest = {
      passed: !!sdk.OpenOxClient,
      detail: sdk.OpenOxClient
        ? `OpenOxClient class imported successfully`
        : "OpenOxClient not found in exports",
    };
  } catch (err) {
    results.importTest = {
      passed: false,
      detail: `Import failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  // Test 2: Are types/interfaces exported?
  try {
    const sdk = await import("@open-ox/sdk");
    const exportedKeys = Object.keys(sdk);
    results.typesTest = {
      passed: exportedKeys.includes("OpenOxClient"),
      detail: `Exports: ${exportedKeys.join(", ")}`,
    };
  } catch (err) {
    results.typesTest = {
      passed: false,
      detail: `${err instanceof Error ? err.message : err}`,
    };
  }

  // Test 3: Can we create a client instance?
  try {
    const { OpenOxClient } = await import("@open-ox/sdk");
    const client = new OpenOxClient({
      llm: { apiKey: "sk-test-not-real" },
      projectsRoot: "/tmp/sdk-test",
    });
    const path = client.getProjectPath("test-123");
    results.configTest = {
      passed: path === "/tmp/sdk-test/test-123",
      detail: `Client created, getProjectPath("test-123") = "${path}"`,
    };
  } catch (err) {
    results.configTest = {
      passed: false,
      detail: `${err instanceof Error ? err.message : err}`,
    };
  }

  // Test 4: Validation works?
  try {
    const { OpenOxClient } = await import("@open-ox/sdk");
    let threw = false;
    try {
      new OpenOxClient({ llm: { apiKey: "" }, projectsRoot: "/tmp" });
    } catch {
      threw = true;
    }
    results.adapterTest = {
      passed: threw,
      detail: threw
        ? "Correctly throws on empty apiKey"
        : "Should have thrown on empty apiKey but didn't",
    };
  } catch (err) {
    results.adapterTest = {
      passed: false,
      detail: `${err instanceof Error ? err.message : err}`,
    };
  }

  // Test 5: Server adapters importable?
  try {
    const server = await import("@open-ox/sdk/server");
    const hasAdapters = !!server.createNodeAdapters;
    const hasFs = !!server.NodeFileSystem;
    const hasShell = !!server.NodeShellExecutor;
    results.serverTest = {
      passed: hasAdapters && hasFs && hasShell,
      detail: `createNodeAdapters=${hasAdapters}, NodeFileSystem=${hasFs}, NodeShellExecutor=${hasShell}`,
    };
  } catch (err) {
    results.serverTest = {
      passed: false,
      detail: `Server import failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  return NextResponse.json(results);
}
