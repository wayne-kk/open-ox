import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { executeSystemTool } from "../../../tools";
import { getSiteRoot } from "../../../tools/system/common";

const FLOW_ROOT = join(process.cwd(), "ai", "flows", "generate_project");
const STEP_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "steps");
const SKILL_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "skills");
const SECTION_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "sections");
const RULE_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "rules");
const GUARDRAIL_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "guardrails");
const MOTION_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "motions");
const LAYOUT_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "layouts");
const CAPABILITY_PROMPTS_ROOT = join(FLOW_ROOT, "prompts", "capabilities");

function readPromptFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Prompt not found: ${path}`);
  }

  return readFileSync(path, "utf-8");
}

export function getStepPromptPath(promptId: string): string {
  return join(STEP_PROMPTS_ROOT, `${promptId}.md`);
}

export function getSectionPromptPath(promptId: string): string {
  return join(SECTION_PROMPTS_ROOT, `${promptId}.md`);
}

export function getSkillPromptsRoot(): string {
  return SKILL_PROMPTS_ROOT;
}

export function getSkillPromptPath(promptId: string): string {
  return join(SKILL_PROMPTS_ROOT, `${promptId}.md`);
}

export function getRulePath(ruleId: string): string {
  return join(RULE_PROMPTS_ROOT, `${ruleId}.md`);
}

export function getGuardrailPath(guardrailId: string): string {
  const modernPath = join(GUARDRAIL_PROMPTS_ROOT, `${guardrailId}.md`);
  return existsSync(modernPath) ? modernPath : getRulePath(guardrailId);
}

export function getMotionPath(motionId: string): string {
  return join(MOTION_PROMPTS_ROOT, `${motionId}.md`);
}

export function getLayoutVariantPath(layoutId: string): string {
  return join(LAYOUT_PROMPTS_ROOT, `${layoutId}.md`);
}

export function getCapabilityAssistPath(capabilityId: string): string {
  const modernPath = join(CAPABILITY_PROMPTS_ROOT, `${capabilityId}.md`);
  if (existsSync(modernPath)) {
    return modernPath;
  }

  if (capabilityId.startsWith("effect.motion.")) {
    return getMotionPath(capabilityId.replace("effect.", ""));
  }

  if (capabilityId.startsWith("pattern.")) {
    return getLayoutVariantPath(capabilityId.replace("pattern.", ""));
  }

  return modernPath;
}

export function hasSectionPrompt(promptId: string): boolean {
  return existsSync(getSectionPromptPath(promptId));
}

export function hasSkillPrompt(promptId: string): boolean {
  return existsSync(getSkillPromptPath(promptId));
}

export function hasGuardrail(guardrailId: string): boolean {
  return existsSync(getGuardrailPath(guardrailId));
}

export function hasLayoutVariant(layoutId: string): boolean {
  return existsSync(getLayoutVariantPath(layoutId));
}

export function hasCapabilityAssist(capabilityId: string): boolean {
  return existsSync(getCapabilityAssistPath(capabilityId));
}

export function loadStepPrompt(promptId: string): string {
  return readPromptFile(getStepPromptPath(promptId));
}

export function loadSectionPrompt(promptId: string): string {
  return readPromptFile(getSectionPromptPath(promptId));
}

export function loadSkillPrompt(promptId: string): string {
  return readPromptFile(getSkillPromptPath(promptId));
}

export function loadRule(ruleId: string): string {
  return readPromptFile(getRulePath(ruleId));
}

export function loadGuardrail(guardrailId: string): string {
  return readPromptFile(getGuardrailPath(guardrailId));
}

export function loadMotion(motionId: string): string {
  return readPromptFile(getMotionPath(motionId));
}

export function loadLayoutVariant(layoutId: string): string {
  return readPromptFile(getLayoutVariantPath(layoutId));
}

export function loadCapabilityAssist(capabilityId: string): string {
  return readPromptFile(getCapabilityAssistPath(capabilityId));
}

export function loadSystem(name: string): string {
  const path = join(process.cwd(), "ai", "prompts", "systems", `${name}.md`);
  if (!existsSync(path)) {
    return "You are a professional AI assistant.";
  }

  return readFileSync(path, "utf-8");
}

export function readSiteFile(relativePath: string): string {
  const fullPath = join(getSiteRoot(), relativePath);
  if (!existsSync(fullPath)) {
    return "";
  }

  return readFileSync(fullPath, "utf-8");
}

export function ensureSiteDir(relativeDir: string): void {
  const dirPath = join(getSiteRoot(), relativeDir);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function writeSiteFile(relativePath: string, content: string): Promise<void> {
  const siteDir = dirname(relativePath);
  if (siteDir && siteDir !== ".") {
    ensureSiteDir(siteDir);
  }

  return executeSystemTool("write_file", {
    path: relativePath,
    content,
  }).then((result) => {
    if (typeof result === "object" && !result.success) {
      throw new Error(`write_file failed for ${relativePath}: ${result.error}`);
    }
  });
}

export async function formatSiteFile(relativePath: string): Promise<void> {
  await executeSystemTool("format_code", { path: relativePath }).catch(() => null);
}

function stripManagedValidationBanner(content: string): string {
  return content
    .replace(/^\/\* @open-ox-validation-status:[^\n]*\*\/\n\n?/, "")
    .replace(/^<!-- @open-ox-validation-status:[\s\S]*?-->\n\n?/, "");
}

function normalizeValidationDetail(detail?: string): string {
  return (detail ?? "build verification failed")
    .replace(/\s+/g, " ")
    .replace(/\*\//g, "* /")
    .replace(/--/g, "- -")
    .trim()
    .slice(0, 240);
}

function buildValidationBanner(relativePath: string, detail?: string): string {
  const normalized = normalizeValidationDetail(detail);
  const ext = relativePath.split(".").pop()?.toLowerCase();

  if (ext === "md") {
    return `<!-- @open-ox-validation-status: failed; detail: ${normalized} -->\n\n`;
  }

  if (["ts", "tsx", "js", "jsx", "css"].includes(ext ?? "")) {
    return `/* @open-ox-validation-status: failed; detail: ${normalized} */\n\n`;
  }

  return "";
}

export async function syncSiteValidationMarkers(
  relativePaths: string[],
  status: "passed" | "failed",
  detail?: string
): Promise<string[]> {
  const touched: string[] = [];
  const uniquePaths = Array.from(new Set(relativePaths));

  for (const relativePath of uniquePaths) {
    const current = readSiteFile(relativePath);
    if (!current) {
      continue;
    }

    const stripped = stripManagedValidationBanner(current);
    const banner = status === "failed" ? buildValidationBanner(relativePath, detail) : "";
    if (status === "failed" && !banner) {
      continue;
    }

    const next = `${banner}${stripped}`;
    if (next === current) {
      continue;
    }

    await writeSiteFile(relativePath, next);
    await formatSiteFile(relativePath);
    touched.push(relativePath);
  }

  return touched;
}
