/**
 * Post-build script:
 * 1. Copy engine bridge .js files to dist (they bypass tsc)
 * 2. Copy prompt .md files to dist
 * 3. Verify dist output exists
 */
import { copyFileSync, cpSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// Copy engine bridge files
const engineFiles = ["engine/generate.js", "engine/modify.js"];
for (const file of engineFiles) {
  const src = join("src", file);
  const dest = join("dist", file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`  📋 ${src} → ${dest}`);
}

// Copy prompt .md files
const promptSrc = join("src", "engine", "prompt-files");
const promptDest = join("dist", "engine", "prompt-files");
if (existsSync(promptSrc)) {
  cpSync(promptSrc, promptDest, { recursive: true });
  console.log(`  📋 src/engine/prompt-files → dist/engine/prompt-files`);
}

// Also copy the generate_project/prompts .md files (they're referenced by the engine)
const flowPromptSrc = join("src", "engine", "flows", "generate_project", "prompts");
const flowPromptDest = join("dist", "engine", "flows", "generate_project", "prompts");
if (existsSync(flowPromptSrc)) {
  cpSync(flowPromptSrc, flowPromptDest, { recursive: true, filter: (s) => !s.endsWith(".ts") || s.endsWith(".d.ts") });
  console.log(`  📋 flow prompts copied`);
}

// Verify required outputs
const required = ["dist/index.js", "dist/index.d.ts", "dist/server.js", "dist/server.d.ts", "dist/engine/generate.js", "dist/engine/modify.js"];
const missing = required.filter((f) => !existsSync(f));

if (missing.length > 0) {
  console.error("❌ Build incomplete. Missing files:");
  missing.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

console.log("✅ SDK build complete");
required.forEach((f) => console.log(`   ${f}`));
