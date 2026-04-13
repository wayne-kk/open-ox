import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { executeSystemTool } from "../../../tools";
import { getSiteRoot } from "../../../tools/system/common";
import { hasPrompt, loadPrompt, resolvePromptPath, composePrompt, resolveGeneratePromptsRoot } from "@/ai/prompts/core";

function readPromptFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Prompt not found: ${path}`);
  }

  return readFileSync(path, "utf-8");
}

export function getStepPromptPath(promptId: string): string {
  return resolvePromptPath("step", promptId);
}

export function getSectionPromptPath(promptId: string): string {
  return resolvePromptPath("section", promptId);
}

export function getSkillPromptsRoot(): string {
  return join(resolveGeneratePromptsRoot(), "skills");
}

export function getSkillPromptPath(promptId: string): string {
  return resolvePromptPath("skill", promptId);
}

export function getRulePromptsRoot(): string {
  return join(resolveGeneratePromptsRoot(), "rules");
}

export function getRulePath(ruleId: string): string {
  return resolvePromptPath("guardrail", ruleId);
}

export function getMotionPath(motionId: string): string {
  return resolvePromptPath("motion", motionId);
}

export function getLayoutVariantPath(layoutId: string): string {
  return resolvePromptPath("layout", layoutId);
}

export function getCapabilityAssistPath(capabilityId: string): string {
  const modernPath = resolvePromptPath("capability", capabilityId);
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
  return hasPrompt("section", promptId);
}

export function hasSkillPrompt(promptId: string): boolean {
  return hasPrompt("skill", promptId);
}

export function hasCapabilityAssist(capabilityId: string): boolean {
  return existsSync(getCapabilityAssistPath(capabilityId));
}

export function loadStepPrompt(promptId: string): string {
  return loadPrompt("step", promptId);
}

export function loadSectionPrompt(promptId: string): string {
  return loadPrompt("section", promptId);
}

export function loadSkillPrompt(promptId: string): string {
  return loadPrompt("skill", promptId);
}

export function loadGuardrail(guardrailId: string): string {
  return loadPrompt("guardrail", guardrailId);
}

export function loadMotion(motionId: string): string {
  return loadPrompt("motion", motionId);
}

export function loadLayoutVariant(layoutId: string): string {
  return loadPrompt("layout", layoutId);
}

export function loadCapabilityAssist(capabilityId: string): string {
  return readPromptFile(getCapabilityAssistPath(capabilityId));
}

export function loadSystem(name: string): string {
  const systemPath = resolvePromptPath("system", name);
  if (!existsSync(systemPath)) {
    return "You are a professional AI assistant.";
  }

  return loadPrompt("system", name);
}

export function composePromptBlocks(blocks: string[]): string {
  return composePrompt({ blocks, dedupe: true });
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
