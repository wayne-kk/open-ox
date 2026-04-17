import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type { PromptKind } from "./types";
import { getPromptProfile } from "./profile";

const ROOT = process.cwd();

function getGenerateFlowName(): "generate_project" | "generate_app" {
  return getPromptProfile() === "app" ? "generate_app" : "generate_project";
}

export function resolveGeneratePromptsRoot(): string {
  return join(ROOT, "ai", "flows", getGenerateFlowName(), "prompts");
}

/**
 * Recursively search for `${filename}` under `dir`.
 * Returns the first match or null.
 */
function findFileRecursive(dir: string, filename: string): string | null {
  // Check top-level first (fast path)
  const direct = join(dir, filename);
  if (existsSync(direct)) return direct;

  // Recurse into subdirectories
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findFileRecursive(join(dir, entry.name), filename);
      if (found) return found;
    }
  }
  return null;
}

export function resolvePromptPath(kind: PromptKind, id: string): string {
  const generateRoot = resolveGeneratePromptsRoot();
  switch (kind) {
    case "step":
      return join(generateRoot, "steps", `${id}.md`);
    case "guardrail":
      return join(generateRoot, "rules", `${id}.md`);
    case "section":
      return join(generateRoot, "sections", `${id}.md`);
    case "skill": {
      const skillsDir = join(generateRoot, "skills");
      return findFileRecursive(skillsDir, `${id}.md`) ?? join(skillsDir, `${id}.md`);
    }
    case "motion":
      return join(generateRoot, "motions", `${id}.md`);
    case "layout":
      return join(generateRoot, "layouts", `${id}.md`);
    case "capability":
      return join(generateRoot, "capabilities", `${id}.md`);
    case "system":
      return join(ROOT, "ai", "prompts", "systems", `${id}.md`);
    case "modify-system":
      return join(ROOT, "ai", "flows", "modify_project", "prompts", "system", `${id}.md`);
    default:
      return join(ROOT, "ai", "prompts", `${id}.md`);
  }
}
