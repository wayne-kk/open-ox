/**
 * Central place to choose which `prompts/rules/*.md` blocks are concatenated into
 * agent system prompts. Changing the arrays (or the env extensions below) is enough
 * — no need to touch individual step files for most rule tuning.
 *
 * `loadGuardrail(id)` resolves `ai/flows/generate_project/prompts/rules/${id}.md`.
 * Section-scoped defaults use ids like `section.default` (same folder as other rules).
 */

/** Comma-separated optional extra rule ids appended after the base list. */
const PAGE_EXTRA_ENV = "PAGE_IMPLEMENT_AGENT_EXTRA_RULES";
const ARCHITECT_EXTRA_ENV = "ARCHITECT_AGENT_EXTRA_RULES";

function parseExtraRuleIds(envVar: string): string[] {
  const raw = process.env[envVar];
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Base stack for `runPageImplementAgent` (after `frontend` + `pageImplementAgent` step). */
export const PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE: readonly string[] = [
  "tailwindMappingGuide",
  "section.default",
  "skillIntegrationContract",
  "project.consistency",
  "project.accessibility",
  "outputTsx",
  "framerMotionVariants",
];

/** Base stack for `runArchitectAgent` (after `frontend` + `architectAgent` step). */
export const ARCHITECT_AGENT_RULE_IDS_BASE: readonly string[] = [
  "section.navigation",
  "section.footer",
  "outputTsx",
  "framerMotionVariants",
];

export function resolvePageImplementAgentRuleIds(): string[] {
  return [...PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE, ...parseExtraRuleIds(PAGE_EXTRA_ENV)];
}

export function resolveArchitectAgentRuleIds(): string[] {
  return [...ARCHITECT_AGENT_RULE_IDS_BASE, ...parseExtraRuleIds(ARCHITECT_EXTRA_ENV)];
}
