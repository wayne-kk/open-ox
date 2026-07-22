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
const AUTO_MATCH_MINIMUM_SCORE = 0.25;
const AUTO_MATCH_SCORE_MARGIN = 0.12;
const AUTO_MATCH_MAX_CANDIDATES = 3;

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

function includesSignal(haystack: string, signal: string): boolean {
  const normalizedSignal = signal.trim().toLowerCase();
  if (!normalizedSignal) return false;
  if (/\p{Script=Han}/u.test(normalizedSignal)) {
    return haystack.includes(normalizedSignal);
  }
  const escapedSignal = normalizedSignal.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedSignal}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(haystack);
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
    .join(" ")
    .toLowerCase();
  const matchedSignals: string[] = [];
  const conflicts: string[] = [];
  let score = 0;

  for (const alias of skill.metadata.aliases) {
    if (!includesSignal(searchableText, alias)) continue;
    matchedSignals.push(`alias:${alias}`);
    score += 0.55;
  }

  for (const mood of skill.metadata.positiveSignals.moods) {
    if (!includesSignal(searchableText, mood)) continue;
    matchedSignals.push(`mood:${mood}`);
    score += 0.12;
  }

  for (const color of skill.metadata.positiveSignals.colors) {
    if (!includesSignal(searchableText, color)) continue;
    matchedSignals.push(`color:${color}`);
    score += 0.12;
  }

  for (const productType of skill.metadata.positiveSignals.productTypes) {
    if (
      request.projectType?.trim().toLowerCase() === productType.toLowerCase()
    ) {
      matchedSignals.push(`productType:${productType}`);
      score += 0.35;
    } else if (includesSignal(searchableText, productType)) {
      matchedSignals.push(`productType:${productType}`);
      score += 0.18;
    }
  }

  for (const [kind, signals] of Object.entries(
    skill.metadata.negativeSignals,
  )) {
    for (const signal of signals) {
      if (includesSignal(searchableText, signal)) {
        conflicts.push(`${kind}:${signal}`);
      }
    }
  }

  if (score < AUTO_MATCH_MINIMUM_SCORE && conflicts.length === 0) return null;
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
      } catch {
        return generateFallback(
          dependencies,
          request,
          "matcher_error",
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
          "matcher_error",
          candidates,
          judgeOutcome,
          observer,
        );
      }

      const runnerUp = candidates.find(
        (candidate) => candidate.skillId !== selectedCandidate.skillId,
      );
      if (
        runnerUp &&
        selectedCandidate.score - runnerUp.score < AUTO_MATCH_SCORE_MARGIN
      ) {
        return generateFallback(
          dependencies,
          request,
          "ambiguous",
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
          "matcher_error",
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
