#!/usr/bin/env npx tsx
/**
 * End-to-end test script for the SDK.
 *
 * This script makes REAL LLM API calls and generates actual files.
 * Run it manually when you want to validate the full pipeline.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx sdk/scripts/e2e-test.ts
 *
 * Optional env vars:
 *   OPENAI_API_URL  - Custom API base URL
 *   OPENAI_MODEL    - Model to use (default: gpt-4o-mini)
 *   E2E_PROMPT      - Custom prompt (default: simple landing page)
 */

import { join } from "path";
import { rmSync, existsSync } from "fs";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is required");
    console.error("   Usage: OPENAI_API_KEY=sk-... npx tsx sdk/scripts/e2e-test.ts");
    process.exit(1);
  }

  // Dynamic imports to test the SDK entry points
  const { OpenOxClient } = await import("../src/client");
  const { createNodeAdapters } = await import("../src/adapters");

  const projectsRoot = join(process.cwd(), ".sdk-e2e-test-output");
  const projectId = `e2e_${Date.now()}`;

  // Clean up previous test output
  if (existsSync(projectsRoot)) {
    rmSync(projectsRoot, { recursive: true });
  }

  console.log("═══════════════════════════════════════════");
  console.log("  Open OX SDK - End-to-End Test");
  console.log("═══════════════════════════════════════════\n");

  const client = new OpenOxClient({
    llm: {
      apiKey,
      baseURL: process.env.OPENAI_API_URL,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
    projectsRoot,
    ...createNodeAdapters(),
  });

  console.log(`Project ID:   ${projectId}`);
  console.log(`Output dir:   ${client.getProjectPath(projectId)}`);
  console.log(`Model:        ${process.env.OPENAI_MODEL ?? "gpt-4o-mini"}`);
  console.log("");

  const prompt =
    process.env.E2E_PROMPT ??
    "A simple one-page landing page for a coffee shop called 'Bean There'. Include a hero section, menu highlights, and a contact section. Keep it minimal.";

  console.log(`Prompt: "${prompt}"\n`);
  console.log("─── Generation Steps ───\n");

  const startTime = Date.now();

  try {
    const result = await client.generateProject({
      prompt,
      projectId,
      mode: "web",
      onStep: (step) => {
        const icon =
          step.status === "ok" ? "✅" : step.status === "error" ? "❌" : "⏳";
        const duration =
          step.duration > 0 ? ` (${(step.duration / 1000).toFixed(1)}s)` : "";
        console.log(`  ${icon} ${step.step}${duration}`);
        if (step.detail) {
          console.log(`     ${step.detail.slice(0, 120)}`);
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n─── Result ───\n");
    console.log(`  Success:      ${result.success ? "✅" : "❌"}`);
    console.log(`  Build:        ${result.verificationStatus}`);
    console.log(`  Files:        ${result.generatedFiles.length}`);
    console.log(`  Duration:     ${elapsed}s`);
    console.log(`  Dependencies: ${result.installedDependencies.length} installed`);

    if (result.dependencyInstallFailures.length > 0) {
      console.log(
        `  Failures:     ${result.dependencyInstallFailures.map((f) => f.packageName).join(", ")}`
      );
    }

    if (result.blueprint) {
      console.log(`\n  Project:      ${result.blueprint.brief.projectTitle}`);
      console.log(
        `  Pages:        ${result.blueprint.site.pages.map((p) => p.slug).join(", ")}`
      );
    }

    if (result.error) {
      console.error(`\n  Error: ${result.error}`);
    }

    // Verify files exist on disk
    console.log("\n─── File Verification ───\n");
    const files = await client.listProjectFiles(projectId);
    console.log(`  Files on disk: ${files.length}`);
    for (const file of files.slice(0, 10)) {
      console.log(`    📄 ${file}`);
    }
    if (files.length > 10) {
      console.log(`    ... and ${files.length - 10} more`);
    }

    console.log("\n═══════════════════════════════════════════");
    console.log(result.success ? "  ✅ E2E TEST PASSED" : "  ❌ E2E TEST FAILED");
    console.log("═══════════════════════════════════════════\n");

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ E2E test crashed after ${elapsed}s:`);
    console.error(err);
    process.exit(1);
  }
}

main();
