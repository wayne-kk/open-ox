import type {
  DesignSystemCandidate,
  DesignSystemFallbackReason,
  DesignSystemResolutionObserver,
  DesignSystemResolutionRequest,
  DesignSystemResolver,
  DesignSystemResolverDependencies,
  DesignSystemSkill,
} from "./types";
import { validateDesignSystemSkill } from "./skillContent";

const AUTO_MATCH_CONFIDENCE_THRESHOLD = 0.86;
const AUTO_MATCH_MINIMUM_SCORE = 0.12;
const AUTO_MATCH_MAX_CANDIDATES = 10;

function matcherFallbackReason(error: unknown): DesignSystemFallbackReason {
  const reason =
    error &&
    typeof error === "object" &&
    "matcherFailureReason" in error &&
    typeof error.matcherFailureReason === "string"
      ? error.matcherFailureReason
      : "matcher_request_failed";
  switch (reason) {
    case "matcher_response_truncated":
    case "matcher_invalid_json":
    case "matcher_request_failed":
      return reason;
    default:
      return "matcher_request_failed";
  }
}

function inferSurfaceMode(
  projectType: string | undefined,
): DesignSystemResolutionRequest["surfaceMode"] {
  const normalized = projectType?.trim().toLowerCase();
  if (!normalized) return undefined;

  if (
    /\b(landing|marketing|portfolio|agency|event|editorial|publication|magazine|blog|brand|showcase)\b/.test(
      normalized,
    )
  ) {
    return "marketing";
  }
  if (
    /\b(web[ -]?app|app|dashboard|developer[ -]?tool|saas|platform|portal|admin|workspace|software|crm|erp)\b/.test(
      normalized,
    )
  ) {
    return "web-app";
  }
  return undefined;
}

function signalPattern(signal: string, global = false): RegExp | null {
  const normalizedSignal = signal.trim().toLowerCase();
  if (!normalizedSignal) return null;
  if (/\p{Script=Han}/u.test(normalizedSignal)) {
    return new RegExp(
      normalizedSignal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      global ? "giu" : "iu",
    );
  }
  const escapedSignal = normalizedSignal.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedSignal}(?![\\p{L}\\p{N}])`,
    global ? "giu" : "iu",
  );
}

function occurrenceIsNegated(haystack: string, index: number): boolean {
  const prefix = haystack.slice(Math.max(0, index - 64), index);
  const lineStart = haystack.lastIndexOf("\n", index - 1) + 1;
  const linePrefix = haystack.slice(lineStart, index);
  const labelledNegativeScope =
    /(?:forbidden|avoid|exclude(?:d|s)?|禁止|避免|不要|排除)\s*[:：]/iu;
  const englishNegation =
    /(?:avoid(?:ed|ing|s)?|without|no|not|never|forbid(?:den|ding|s)?|exclude(?:d|s|ing)?|do not|don't|must not)\s*(?::|：|-)?\s*(?:[\p{L}\p{N}_-]+\s+){0,3}$/iu;
  const chineseNegation =
    /(?:避免|不要|禁止|不得|不使用|排除|拒绝)[^，。；;\n]{0,18}(?::|：)?\s*$/u;
  return (
    labelledNegativeScope.test(linePrefix) ||
    englishNegation.test(prefix) ||
    chineseNegation.test(prefix)
  );
}

function includesAffirmedSignal(haystack: string, signal: string): boolean {
  const pattern = signalPattern(signal, true);
  if (!pattern) return false;
  for (const match of haystack.matchAll(pattern)) {
    if (!occurrenceIsNegated(haystack, match.index ?? 0)) return true;
  }
  return false;
}

function buildCandidate(
  request: DesignSystemResolutionRequest,
  skill: DesignSystemSkill,
): DesignSystemCandidate | null {
  if (skill.metadata.status !== "active") return null;
  if (
    request.surfaceMode &&
    !skill.metadata.supportedModes.includes(request.surfaceMode)
  ) {
    return null;
  }

  const searchableText = [
    request.userInput,
    request.designIntentMarkdown,
    request.projectType ?? "",
    request.legacyStyleGuide ?? "",
  ]
    .join("\n")
    .toLowerCase();
  const matchedSignals: string[] = [];
  const conflicts: string[] = [];
  let score = 0;

  for (const alias of skill.metadata.aliases) {
    if (!includesAffirmedSignal(searchableText, alias)) continue;
    matchedSignals.push(`alias:${alias}`);
    score += 0.55;
  }

  for (const mood of skill.metadata.positiveSignals.moods) {
    if (!includesAffirmedSignal(searchableText, mood)) continue;
    matchedSignals.push(`mood:${mood}`);
    score += 0.12;
  }

  for (const color of skill.metadata.positiveSignals.colors) {
    if (!includesAffirmedSignal(searchableText, color)) continue;
    matchedSignals.push(`color:${color}`);
    score += 0.12;
  }

  for (const productType of skill.metadata.positiveSignals.productTypes) {
    if (
      request.projectType?.trim().toLowerCase() === productType.toLowerCase()
    ) {
      matchedSignals.push(`productType:${productType}`);
      score += 0.35;
    } else if (includesAffirmedSignal(searchableText, productType)) {
      matchedSignals.push(`productType:${productType}`);
      score += 0.18;
    }
  }

  for (const [kind, signals] of Object.entries(
    skill.metadata.negativeSignals,
  )) {
    for (const signal of signals) {
      if (includesAffirmedSignal(searchableText, signal)) {
        conflicts.push(`${kind}:${signal}`);
      }
    }
  }

  // Retrieval is recall-oriented: negative-only hits are not candidates, and
  // the LLM judge (not this lexical score) makes the final semantic choice.
  if (score < AUTO_MATCH_MINIMUM_SCORE) return null;
  return {
    skillId: skill.metadata.id,
    score: Math.min(1, Number(score.toFixed(3))),
    matchedSignals,
    conflicts,
  };
}

function shortlistCandidates(
  request: DesignSystemResolutionRequest,
  skills: DesignSystemSkill[],
): DesignSystemCandidate[] {
  return skills
    .map((skill) => buildCandidate(request, skill))
    .filter(
      (candidate): candidate is DesignSystemCandidate => candidate !== null,
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, AUTO_MATCH_MAX_CANDIDATES);
}

async function generateFallback(
  dependencies: DesignSystemResolverDependencies,
  request: DesignSystemResolutionRequest,
  fallbackReason: DesignSystemFallbackReason,
  candidates: DesignSystemCandidate[],
  judgeOutcome?: Awaited<ReturnType<DesignSystemResolverDependencies["judge"]>>,
  observer?: DesignSystemResolutionObserver,
) {
  const matchOutcome = {
    source: "generated" as const,
    fallbackReason,
    trace: {
      candidates,
      ...(judgeOutcome
        ? {
            decision: judgeOutcome.decision,
            ...(judgeOutcome.trace ? { judgeTrace: judgeOutcome.trace } : {}),
          }
        : {}),
    },
  };
  observer?.onMatchResolved?.(matchOutcome);
  const generated = await dependencies.generate(request);
  return {
    ...matchOutcome,
    designSystem: generated.designSystem,
    trace: {
      ...matchOutcome.trace,
      ...(generated.trace ? { generationTrace: generated.trace } : {}),
    },
  };
}

export function createDesignSystemResolver(
  dependencies: DesignSystemResolverDependencies,
): DesignSystemResolver {
  return {
    async resolve(
      request: DesignSystemResolutionRequest,
      observer?: DesignSystemResolutionObserver,
    ) {
      if (request.matchingEnabled === false) {
        return generateFallback(
          dependencies,
          request,
          "matching_disabled",
          [],
          undefined,
          observer,
        );
      }

      const selectedId = request.selectedSkill?.id.trim();
      if (selectedId) {
        const selected = dependencies.catalog.get(selectedId);
        const requestedVersion = request.selectedSkill?.version;
        if (
          selected?.metadata.status === "active" &&
          Boolean(requestedVersion) &&
          requestedVersion === selected.metadata.version
        ) {
          const validation = validateDesignSystemSkill(selected);
          if (validation.valid) {
            const outcome = {
              source: "skill" as const,
              skillId: selected.metadata.id,
              skillVersion: selected.metadata.version,
              confidence: 1,
              reason: "explicit_selection" as const,
              trace: { candidates: [] },
            };
            observer?.onMatchResolved?.(outcome);
            return { ...outcome, designSystem: selected.content };
          }

          return generateFallback(
            dependencies,
            request,
            "skill_invalid",
            [],
            undefined,
            observer,
          );
        }
        return generateFallback(
          dependencies,
          request,
          "skill_invalid",
          [],
          undefined,
          observer,
        );
      }

      if (request.screenshotMode === "replicate_layout") {
        return generateFallback(
          dependencies,
          request,
          "screenshot_replica",
          [],
          undefined,
          observer,
        );
      }

      const matchRequest = request.surfaceMode
        ? request
        : { ...request, surfaceMode: inferSurfaceMode(request.projectType) };
      const candidates = shortlistCandidates(
        matchRequest,
        dependencies.catalog.list(),
      );
      if (candidates.length === 0) {
        return generateFallback(
          dependencies,
          request,
          "no_candidate",
          candidates,
          undefined,
          observer,
        );
      }

      let judgeOutcome;
      try {
        judgeOutcome = await dependencies.judge(matchRequest, candidates);
      } catch (error) {
        return generateFallback(
          dependencies,
          request,
          matcherFallbackReason(error),
          candidates,
          undefined,
          observer,
        );
      }
      const { decision } = judgeOutcome;

      if (decision.conflicts.length > 0) {
        return generateFallback(
          dependencies,
          request,
          "explicit_conflict",
          candidates,
          judgeOutcome,
          observer,
        );
      }
      if (
        !decision.skillId ||
        decision.confidence < AUTO_MATCH_CONFIDENCE_THRESHOLD
      ) {
        return generateFallback(
          dependencies,
          request,
          "low_confidence",
          candidates,
          judgeOutcome,
          observer,
        );
      }

      const selectedCandidate = candidates.find(
        (candidate) => candidate.skillId === decision.skillId,
      );
      if (!selectedCandidate) {
        return generateFallback(
          dependencies,
          request,
          "matcher_skill_not_in_candidates",
          candidates,
          judgeOutcome,
          observer,
        );
      }

      const selected = dependencies.catalog.get(selectedCandidate.skillId);
      if (!selected) {
        return generateFallback(
          dependencies,
          request,
          "matcher_catalog_miss",
          candidates,
          judgeOutcome,
          observer,
        );
      }
      const validation = validateDesignSystemSkill(selected);
      if (!validation.valid) {
        return generateFallback(
          dependencies,
          request,
          "skill_invalid",
          candidates,
          judgeOutcome,
          observer,
        );
      }

      const outcome = {
        source: "skill" as const,
        skillId: selected.metadata.id,
        skillVersion: selected.metadata.version,
        confidence: decision.confidence,
        reason: "automatic_match" as const,
        trace: {
          candidates,
          decision,
          ...(judgeOutcome.trace ? { judgeTrace: judgeOutcome.trace } : {}),
        },
      };
      observer?.onMatchResolved?.(outcome);
      return { ...outcome, designSystem: selected.content };
    },
  };
}
