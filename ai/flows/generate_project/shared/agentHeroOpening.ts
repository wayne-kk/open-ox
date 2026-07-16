import type { PlannedPageBlueprint, PlannedSectionSpec } from "../types";

/** Slugs that are almost never "marketing opening + visual hero" patterns. */
const UTILITY_SLUG_SNIPPET =
  /\b(sign-?in|sign-?up|log-?in|register|settings|billing|checkout|invite|otp|oauth|callback|reset-?password|verify|2fa|admin|console)\b/i;

/**
 * @deprecated Hero skill selection removed from generatePages / Page Agent.
 *
 * Whether this route is a good candidate for attaching the **hero** skill
 * catalog (opening / above-the-fold visual patterns).
 *
 * This intentionally does **not** rely on `section.type === "hero"`: in agent
 * mode `plan_project` emits `sections: []`, so we use the same mainstream
 * heuristics product teams use:
 *
 * - **Primary landing surfaces** (home / marketing-ish slugs / entry journey stages)
 * - **Otherwise**: strong "opening visual" signals in the page plan + user brief
 * - **Blacklist**: utility / auth / billing-ish routes unless explicitly marketing-flavored copy says otherwise
 */
export function shouldOfferHeroSkillForAgentPage(
  page: PlannedPageBlueprint,
  rawUserInput?: string
): boolean {
  const slug = page.slug.trim().toLowerCase();
  if (!slug || UTILITY_SLUG_SNIPPET.test(slug)) {
    const blobFallback = `${rawUserInput ?? ""} ${page.description}`.toLowerCase();
    if (
      /\b(marketing\s*site|landing\s*page|homepage\s*hero|campaign)\b/i.test(blobFallback)
    ) {
      // Explicit marketing wording can override an awkward slug fragment.
    } else {
      return false;
    }
  }

  const journey = page.journeyStage.trim().toLowerCase();
  const isPrimaryLanding =
    slug === "home" ||
    slug === "index" ||
    /^(landing|lp|marketing|launch)\b|^promo-|^campaign-/i.test(slug);
  const isAwarenessStage =
    /\b(entry|landing|awareness|discover(?:y)?|marketing|story|homepage|pre-?launch)\b/i.test(
      journey
    );

  if (isPrimaryLanding || isAwarenessStage) {
    return true;
  }

  const blob = buildPageSignalBlob(page, rawUserInput).toLowerCase();

  const looksLikeDenseAppShell =
    /\b(data\s*grid|dense\s*table|spreadsheet|kanban\s*only|saas\s*console|admin\s*panel|wizard\s*(?:steps|only)|(?:pure|only)\s*form)\b/i.test(
      blob
    ) && !/\b(landing|marketing|homepage|hero|opening|splash|cinematic)\b/i.test(blob);
  if (looksLikeDenseAppShell) {
    return false;
  }

  return /\b(hero|above[\s_-]?fold|opening|marquee|billboard|full[\s_-]?(?:screen|viewport)|immersive|splash|sticky\s*header|cinematic|headline\b|particles|shader|three\.?js|\bwebgl\b|ambient\s+(?:lit|gradient|glow)|gradient\s+blobs|floating\s+cta)\b/i.test(
    blob
  );
}

function buildPageSignalBlob(page: PlannedPageBlueprint, rawUserInput?: string): string {
  const plan = page.pageDesignPlan;
  return [
    rawUserInput ?? "",
    page.title,
    page.description,
    page.journeyStage,
    plan.pageGoal,
    plan.narrativeArc,
    plan.layoutStrategy,
    plan.hierarchy.join(" · "),
    plan.constraints.join(" · "),
  ]
    .join("\n")
    .trim();
}

/**
 * @deprecated Hero skill selection removed from generatePages.
 * Synthesize a section-shaped payload so `discoverAndSelectSkill` can run the
 * hero catalog + LLM picker. `type` is **`hero` only as a routing key** into
 * `section/hero/skills.yaml`, not as a planner-assigned label.
 */
export function buildVirtualHeroSectionForSkillSelection(
  page: PlannedPageBlueprint
): PlannedSectionSpec {
  const plan = page.pageDesignPlan;
  const safeSlug = page.slug.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "page";
  return {
    type: "hero",
    intent: `[${page.slug}] ${page.title}. Goal: ${plan.pageGoal} Flow: ${plan.narrativeArc}`,
    contentHints: [
      page.description.trim(),
      `Layout strategy: ${plan.layoutStrategy}`,
      `Information hierarchy: ${plan.hierarchy.join(" → ")}`,
      ...plan.constraints.map((c) => `Constraint: ${c}`),
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
    fileName: `OpeningVisual__${safeSlug}`,
  };
}
