import { join } from "path";
import type { PromptKind } from "./types";

const ROOT = process.cwd();
const GENERATE_ROOT = join(ROOT, "ai", "flows", "generate_project", "prompts");

export function resolvePromptPath(kind: PromptKind, id: string): string {
  switch (kind) {
    case "step":
      return join(GENERATE_ROOT, "steps", `${id}.md`);
    case "guardrail":
      return join(GENERATE_ROOT, "rules", `${id}.md`);
    case "section":
      return join(GENERATE_ROOT, "sections", `${id}.md`);
    case "skill":
      return join(GENERATE_ROOT, "skills", `${id}.md`);
    case "motion":
      return join(GENERATE_ROOT, "motions", `${id}.md`);
    case "layout":
      return join(GENERATE_ROOT, "layouts", `${id}.md`);
    case "capability":
      return join(GENERATE_ROOT, "capabilities", `${id}.md`);
    case "system":
      return join(ROOT, "ai", "prompts", "systems", `${id}.md`);
    case "modify-system":
      return join(ROOT, "ai", "flows", "modify_project", "prompts", "system", `${id}.md`);
    default:
      return join(ROOT, "ai", "prompts", `${id}.md`);
  }
}
