import type { SiteOutline } from "./siteOutline";

export type DirectionLockGenerationCommitSource = "intent_agent" | "direction_lock_ui";

export type DirectionLockGenerationCommitValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION"
        | "CONFIRMED_SITE_OUTLINE_REQUIRED";
      message: string;
    };

/** Server-side authority for which path may enqueue generation while direction lock is enabled. */
export function validateDirectionLockGenerationCommit(input: {
  directionLockEnabled: boolean;
  source: DirectionLockGenerationCommitSource;
  hasConfirmedSiteOutline: boolean;
}): DirectionLockGenerationCommitValidation {
  if (!input.directionLockEnabled) return { ok: true };

  if (input.source !== "direction_lock_ui") {
    return {
      ok: false,
      code: "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION",
      message: "Direction lock requires confirmation from the Studio direction panel.",
    };
  }

  if (!input.hasConfirmedSiteOutline) {
    return {
      ok: false,
      code: "CONFIRMED_SITE_OUTLINE_REQUIRED",
      message: "Direction lock requires a valid confirmedSiteOutline.",
    };
  }

  return { ok: true };
}

export function resolveDirectionLockBrief(input: {
  currentBriefDraft?: string | null;
  priorBriefDrafts?: Array<string | null | undefined>;
  bootstrapUserPrompt?: string | null;
}): string | null {
  const current = input.currentBriefDraft?.trim();
  if (current) return current;

  for (const candidate of [...(input.priorBriefDrafts ?? [])].reverse()) {
    const brief = candidate?.trim();
    if (brief) return brief;
  }

  return input.bootstrapUserPrompt?.trim() || null;
}

/**
 * Server-authoritative prompt for a direction-lock commit. The confirmed
 * outline remains explicit even when the UI submits only confirmation copy.
 */
export function buildDirectionLockGenerationPrompt(input: {
  submittedBrief: string;
  bootstrapUserPrompt?: string | null;
  confirmedSiteOutline: SiteOutline;
}): string {
  const submittedBrief = input.submittedBrief.trim();
  const bootstrapUserPrompt = input.bootstrapUserPrompt?.trim() ?? "";
  const includeSubmittedBrief =
    submittedBrief.length >= 16 && submittedBrief !== bootstrapUserPrompt;
  const modules = input.confirmedSiteOutline.modules
    .map((module, index) => {
      const details = [module.intent?.trim(), module.contentHints?.trim()]
        .filter(Boolean)
        .join("；");
      return `${index + 1}. ${module.title.trim()}${details ? `：${details}` : ""}`;
    })
    .join("\n");

  return [
    "# 已确认的生成需求",
    bootstrapUserPrompt ? `## 原始用户需求\n${bootstrapUserPrompt}` : "",
    includeSubmittedBrief ? `## 已确认需求摘要\n${submittedBrief}` : "",
    `## 已确认页面目标\n${input.confirmedSiteOutline.pageGoal.trim()}`,
    `## 已确认首页结构（顺序与主题必须保留）\n${modules}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
