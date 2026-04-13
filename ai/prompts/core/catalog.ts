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

export function resolvePromptPath(kind: PromptKind, id: string): string {
  const generateRoot = resolveGeneratePromptsRoot();
  switch (kind) {
    case "step":
      return join(generateRoot, "steps", `${id}.md`);
    case "guardrail":
      return join(generateRoot, "rules", `${id}.md`);
    case "section":
      return join(generateRoot, "sections", `${id}.md`);
    case "skill":
      return join(generateRoot, "skills", `${id}.md`);
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
