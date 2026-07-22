import {
  composePromptBlocks,
  loadGuardrail,
  loadStepPrompt,
} from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { stepGenerateProjectDesignSystem } from "../steps/generateProjectDesignSystem";
import { getModelForStep } from "@/lib/config/models";
import {
  lfPlain,
  LfPlain,
} from "@/lib/observability/langfuseGenerationCatalog";
import { createFileDesignSystemSkillCatalog } from "./catalog";
import { createDesignSystemResolver } from "./resolveDesignSystem";
import {
  CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION,
  validateDesignSystemContract,
} from "./validator";
import type {
  DesignSystemCandidate,
  DesignSystemJudgeDecision,
  DesignSystemResolutionRequest,
  DesignSystemResolutionObserver,
  DesignSystemSkillCatalog,
} from "./types";

const catalog = createFileDesignSystemSkillCatalog();

async function generateContractValidDesignSystem(
  request: DesignSystemResolutionRequest,
) {
  const first = await stepGenerateProjectDesignSystem(
    request.designIntentMarkdown,
    request.legacyStyleGuide,
  );
  const firstValidation = validateDesignSystemContract(
    first.designSystem,
    CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION,
  );
  if (firstValidation.valid) {
    first.trace.validationResult = {
      passed: true,
      checks: [{ name: "design-system-contract-v1", passed: true }],
    };
    return first;
  }

  const repairGuide = [
    request.legacyStyleGuide ?? "",
    "## Contract repair required",
    "Regenerate the complete document and fix every validation error below:",
    ...firstValidation.errors.map((error) => `- ${error}`),
  ]
    .filter(Boolean)
    .join("\n");
  const second = await stepGenerateProjectDesignSystem(
    request.designIntentMarkdown,
    repairGuide,
  );
  const secondValidation = validateDesignSystemContract(
    second.designSystem,
    CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION,
  );
  second.trace.validationResult = {
    passed: secondValidation.valid,
    checks: [
      {
        name: "design-system-contract-v1",
        passed: secondValidation.valid,
        ...(secondValidation.errors.length > 0
          ? { detail: secondValidation.errors.join(" | ") }
          : {}),
      },
    ],
  };
  if (!secondValidation.valid) {
    throw new Error(
      `Generated design system failed contract validation: ${secondValidation.errors.join(" | ")}`,
    );
  }
  return second;
}

function formatCandidate(
  candidate: DesignSystemCandidate,
  skillCatalog: DesignSystemSkillCatalog,
): string {
  const skill = skillCatalog.get(candidate.skillId);
  if (!skill) return `- id: ${candidate.skillId}`;
  const metadata = skill.metadata;
  return [
    `- id: ${metadata.id}`,
    `  deterministicScore: ${candidate.score}`,
    `  matchedSignals: ${candidate.matchedSignals.join(", ") || "none"}`,
    `  potentialNegativeHits: ${candidate.conflicts.join(", ") || "none"}`,
    `  aliases: ${metadata.aliases.join(", ")}`,
    `  moods: ${metadata.positiveSignals.moods.join(", ")}`,
    `  colors: ${metadata.positiveSignals.colors.join(", ")}`,
    `  productTypes: ${metadata.positiveSignals.productTypes.join(", ")}`,
    `  exclusions: ${[
      ...metadata.negativeSignals.moods,
      ...metadata.negativeSignals.colors,
      ...metadata.negativeSignals.productTypes,
    ].join(", ")}`,
  ].join("\n");
}

function normalizeDecision(raw: unknown): DesignSystemJudgeDecision {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const skillId =
    typeof value.skillId === "string" && value.skillId.trim()
      ? value.skillId.trim()
      : null;
  const confidenceValue =
    typeof value.confidence === "number" ? value.confidence : 0;
  const stringList = (input: unknown): string[] =>
    Array.isArray(input)
      ? input
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
      : [];
  return {
    skillId,
    confidence: Math.max(0, Math.min(1, confidenceValue)),
    evidence: stringList(value.evidence),
    conflicts: stringList(value.conflicts),
    reason: typeof value.reason === "string" ? value.reason.trim() : "",
  };
}

async function judgeCandidates(
  skillCatalog: DesignSystemSkillCatalog,
  request: DesignSystemResolutionRequest,
  candidates: DesignSystemCandidate[],
) {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("matchDesignSystemSkill"),
    loadGuardrail("outputJson"),
  ]);
  const userMessage = [
    "## Original requirement",
    request.userInput,
    "",
    "## Inferred design intent",
    request.designIntentMarkdown,
    "",
    ...(request.legacyStyleGuide
      ? ["## Explicit style guide", request.legacyStyleGuide, ""]
      : []),
    `## Project type\n${request.projectType || "unknown"}`,
    `## Surface mode\n${request.surfaceMode || "unknown"}`,
    "",
    "## Candidate skills",
    candidates
      .map((candidate) => formatCandidate(candidate, skillCatalog))
      .join("\n\n"),
  ].join("\n");

  const meta = await callLLMWithMeta(
    systemPrompt,
    userMessage,
    0,
    256,
    getModelForStep("match_design_system_skill"),
    { langfuseName: lfPlain(LfPlain.matchDesignSystemSkill) },
  );
  return {
    decision: normalizeDecision(JSON.parse(extractJSON(meta.content))),
    trace: stepTraceFromLlmCompletion(systemPrompt, userMessage, meta),
  };
}

const productionResolver = createDesignSystemResolver({
  catalog,
  judge: (request, candidates) => judgeCandidates(catalog, request, candidates),
  generate: async (request) => {
    const generated = await generateContractValidDesignSystem(request);
    return { designSystem: generated.designSystem, trace: generated.trace };
  },
});

export async function resolveDesignSystem(
  request: DesignSystemResolutionRequest,
  observer?: DesignSystemResolutionObserver,
) {
  return productionResolver.resolve(request, observer);
}
