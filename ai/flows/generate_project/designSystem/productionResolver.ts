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

export const MATCHER_OUTPUT_MAX_TOKENS = 1024;

type MatcherFailureReason =
  | "matcher_response_truncated"
  | "matcher_invalid_json"
  | "matcher_request_failed";

export class DesignSystemMatcherError extends Error {
  readonly matcherFailureReason: MatcherFailureReason;

  constructor(reason: MatcherFailureReason, message: string, cause?: unknown) {
    super(message);
    this.name = "DesignSystemMatcherError";
    this.matcherFailureReason = reason;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

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
  const rawSkillId =
    typeof value.skillId === "string" ? value.skillId.trim() : "";
  const skillId =
    rawSkillId &&
    !new Set(["null", "none", "no_match", "no-match", "n/a"]).has(
      rawSkillId.toLowerCase(),
    )
      ? rawSkillId
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

export function parseDesignSystemMatcherResponse(
  content: string,
): DesignSystemJudgeDecision {
  const parsed = JSON.parse(extractJSON(content));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Design-system matcher response must be a JSON object");
  }
  return normalizeDecision(parsed);
}

function looksLikeTruncatedJson(content: string): boolean {
  const extracted = extractJSON(content).trim();
  return extracted.startsWith("{") && !extracted.endsWith("}");
}

function requestFailureLooksTruncated(error: unknown): boolean {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    } else {
      messages.push(String(current));
      break;
    }
  }
  return /truncat|max[_ -]?tokens|finish_reason\s*=\s*length/i.test(
    messages.join(" "),
  );
}

export async function judgeCandidates(
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

  const model = getModelForStep("match_design_system_skill");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptMessage =
      attempt === 0
        ? userMessage
        : `${userMessage}\n\n## Retry requirement\nThe previous response was invalid or truncated. Return one complete, compact JSON object only.`;
    let meta;
    try {
      meta = await callLLMWithMeta(
        systemPrompt,
        attemptMessage,
        0,
        MATCHER_OUTPUT_MAX_TOKENS,
        model,
        {
          langfuseName: lfPlain(LfPlain.matchDesignSystemSkill),
          thinkingLevel: "minimal",
        },
      );
    } catch (error) {
      if (requestFailureLooksTruncated(error)) {
        if (attempt === 0) continue;
        throw new DesignSystemMatcherError(
          "matcher_response_truncated",
          "Design-system matcher exhausted its output budget twice",
          error,
        );
      }
      throw new DesignSystemMatcherError(
        "matcher_request_failed",
        "Design-system matcher request failed",
        error,
      );
    }

    try {
      return {
        decision: parseDesignSystemMatcherResponse(meta.content),
        trace: stepTraceFromLlmCompletion(systemPrompt, attemptMessage, meta),
      };
    } catch (error) {
      if (attempt === 0) continue;
      const reason = looksLikeTruncatedJson(meta.content)
        ? "matcher_response_truncated"
        : "matcher_invalid_json";
      throw new DesignSystemMatcherError(
        reason,
        `Design-system matcher returned unusable JSON after ${attempt + 1} attempts`,
        error,
      );
    }
  }

  throw new DesignSystemMatcherError(
    "matcher_invalid_json",
    "Design-system matcher did not return a decision",
  );
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
