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
const ARCHITECT_SCAFFOLD_EXTRA_ENV = "ARCHITECT_SCAFFOLD_AGENT_EXTRA_RULES";
const CHROME_OPTIMIZE_EXTRA_ENV = "CHROME_OPTIMIZE_AGENT_EXTRA_RULES";
/** @deprecated Use ARCHITECT_SCAFFOLD_AGENT_EXTRA_RULES */
const ARCHITECT_EXTRA_ENV = "ARCHITECT_AGENT_EXTRA_RULES";

function parseExtraRuleIds(envVar: string): string[] {
  const raw = process.env[envVar];
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Base stack for `runPageImplementAgent` (after `frontend` + `pageImplementAgent` step).
 *
 * FROZEN LENGTH: new rules must **replace** an entry or load conditionally
 * (`PAGE_IMPLEMENT_AGENT_EXTRA_RULES` / image-gated ids). Do **not** append
 * indefinitely — context bloat dilutes visual attention.
 *
 * Soft caps: {@link PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE_MAX_LENGTH} (count) and
 * {@link PAGE_IMPLEMENT_AGENT_RULE_BODIES_MAX_CHARS} (sum of rule md bodies).
 */
export const PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE_MAX_LENGTH = 8;

/** Measured freeze ceiling for base rule markdown bodies (2026-07). Do not grow without review. */
export const PAGE_IMPLEMENT_AGENT_RULE_BODIES_MAX_CHARS = 22_000;

export const PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE: readonly string[] = [
  "tailwindMappingGuide",
  "section.default",
  "skillIntegrationContract",
  "project.consistency",
  "project.accessibility",
  "outputTsx",
  "framerMotionVariants",
];

/** Base stack for chrome scaffold agent. */
export const ARCHITECT_SCAFFOLD_AGENT_RULE_IDS_BASE: readonly string[] = [
  "section.navigation",
  "section.footer",
  "outputTsx",
  "framerMotionVariants",
];

/** Base stack for chrome optimize agent. */
export const CHROME_OPTIMIZE_AGENT_RULE_IDS_BASE: readonly string[] = [
  "section.navigation",
  "section.footer",
  "outputTsx",
  "framerMotionVariants",
];

/** @deprecated Use ARCHITECT_SCAFFOLD_AGENT_RULE_IDS_BASE */
export const ARCHITECT_AGENT_RULE_IDS_BASE = ARCHITECT_SCAFFOLD_AGENT_RULE_IDS_BASE;

export function resolvePageImplementAgentRuleIds(opts?: {
  userProvidedImageCount?: number;
}): string[] {
  const imageCount = opts?.userProvidedImageCount ?? 0;
  const rest = PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE.filter(
    (id) => id !== "section.default" && id !== "tailwindMappingGuide"
  );
  const sectionRules =
    imageCount > 0
      ? ["section.userProvidedImages", "section.default"]
      : ["section.default"];
  return [
    "tailwindMappingGuide",
    ...sectionRules,
    ...rest,
    ...parseExtraRuleIds(PAGE_EXTRA_ENV),
  ];
}

export function resolveArchitectScaffoldAgentRuleIds(): string[] {
  const extra = [
    ...parseExtraRuleIds(ARCHITECT_SCAFFOLD_EXTRA_ENV),
    ...parseExtraRuleIds(ARCHITECT_EXTRA_ENV),
  ];
  return [...ARCHITECT_SCAFFOLD_AGENT_RULE_IDS_BASE, ...extra];
}

export function resolveChromeOptimizeAgentRuleIds(): string[] {
  return [...CHROME_OPTIMIZE_AGENT_RULE_IDS_BASE, ...parseExtraRuleIds(CHROME_OPTIMIZE_EXTRA_ENV)];
}

/** @deprecated Use resolveArchitectScaffoldAgentRuleIds */
export function resolveArchitectAgentRuleIds(): string[] {
  return resolveArchitectScaffoldAgentRuleIds();
}
