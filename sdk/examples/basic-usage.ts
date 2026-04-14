/**
 * Basic SDK usage example - Generate a project programmatically
 */

import { OpenOxClient } from "@open-ox/sdk";
import { createNodeAdapters } from "@open-ox/sdk/server";

async function main() {
  const client = new OpenOxClient({
    llm: {
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_API_URL,
      model: "gpt-4o",
      // Per-step model overrides
      stepModels: {
        analyze_project_requirement: "gpt-4o",
        generate_section: "gpt-4o-mini",
      },
    },
    projectsRoot: "./generated-projects",
    ...createNodeAdapters(),
  });

  console.log("Starting project generation...\n");

  const result = await client.generateProject({
    prompt: "Build a modern SaaS landing page for a project management tool called TaskFlow",
    mode: "web",
    onStep: (step) => {
      const icon = step.status === "ok" ? "✅" : step.status === "error" ? "❌" : "⏳";
      const duration = step.duration > 0 ? ` (${(step.duration / 1000).toFixed(1)}s)` : "";
      console.log(`${icon} ${step.step}${duration} ${step.detail ?? ""}`);
    },
  });

  console.log("\n─── Result ───");
  console.log(`Success: ${result.success}`);
  console.log(`Build: ${result.verificationStatus}`);
  console.log(`Files: ${result.generatedFiles.length}`);
  console.log(`Duration: ${((result.totalDuration ?? 0) / 1000).toFixed(1)}s`);

  if (result.blueprint) {
    console.log(`\nProject: ${result.blueprint.brief.projectTitle}`);
    console.log(`Pages: ${result.blueprint.site.pages.map((p) => p.slug).join(", ")}`);
  }

  if (result.error) {
    console.error(`\nError: ${result.error}`);
  }
}

main().catch(console.error);
