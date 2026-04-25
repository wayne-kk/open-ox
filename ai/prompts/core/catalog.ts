import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type { PromptKind } from "./types";

const ROOT = process.cwd();

const GENERATE_PROJECT_ROOT = join(ROOT, "ai", "flows", "generate_project", "prompts");

export function resolveGeneratePromptsRoot(): string {
  return GENERATE_PROJECT_ROOT;
}

/**
 * Recursively search for `${filename}` under `dir`.
 * Returns the first match or null.
 */
function findFileRecursive(dir: string, filename: string): string | null {
  const direct = join(dir, filename);
  if (existsSync(direct)) return direct;

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
  return resolvePromptPathInRoot(GENERATE_PROJECT_ROOT, kind, id);
}

function resolvePromptPathInRoot(generateRoot: string, kind: PromptKind, id: string): string {
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
