/**
 * Pre-generate SiteOutline — lightweight IA confirmed in Studio before commit.
 * @see docs/product/generate-blueprint-preview-v0.1-prd.md
 */

import type { SectionSpec } from "@/ai/flows/generate_project/types";

export const SITE_OUTLINE_MODULE_TYPES = [
  "hero",
  "logo_cloud",
  "features",
  "how_it_works",
  "testimonials",
  "pricing",
  "faq",
  "cta",
  "footer",
  "custom",
] as const;

export type SiteOutlineModuleType = (typeof SITE_OUTLINE_MODULE_TYPES)[number];

export type SiteOutlineModule = {
  id: string;
  type: SiteOutlineModuleType;
  title: string;
  intent?: string;
  contentHints?: string;
};

export type SiteOutline = {
  pageSlug: "home";
  pageGoal: string;
  modules: SiteOutlineModule[];
};

const TYPE_SET = new Set<string>(SITE_OUTLINE_MODULE_TYPES);

const TYPE_LABELS: Record<SiteOutlineModuleType, string> = {
  hero: "Hero",
  logo_cloud: "Logo cloud",
  features: "Features",
  how_it_works: "How it works",
  testimonials: "Testimonials",
  pricing: "Pricing",
  faq: "FAQ",
  cta: "CTA",
  footer: "Footer",
  custom: "Custom",
};

export function siteOutlineModuleTypeLabel(type: SiteOutlineModuleType): string {
  return TYPE_LABELS[type];
}

export function isSiteOutlineModuleType(value: unknown): value is SiteOutlineModuleType {
  return typeof value === "string" && TYPE_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function newModuleId(index: number): string {
  return `mod_${index + 1}_${Math.random().toString(36).slice(2, 8)}`;
}

/** PascalCase file stem from type + index (stable for a given outline order). */
export function sectionFileNameForModule(type: SiteOutlineModuleType, index: number): string {
  const stem = type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${stem}${index === 0 ? "" : index + 1}.tsx`;
}

export function outlineToSectionSpecs(outline: SiteOutline): SectionSpec[] {
  const usedNames = new Set<string>();
  return outline.modules.map((mod, index) => {
    const intentParts = [mod.title, mod.intent].filter(Boolean);
    let fileName = sectionFileNameForModule(mod.type, index);
    if (usedNames.has(fileName)) {
      fileName = `${fileName.replace(/\.tsx$/, "")}_${mod.id}.tsx`;
    }
    usedNames.add(fileName);
    return {
      type: mod.type,
      intent: intentParts.join(" — ") || mod.type,
      contentHints: mod.contentHints?.trim() || mod.title || mod.type,
      fileName,
    };
  });
}

/**
 * Parse and validate SiteOutline JSON. Returns null when unusable.
 */
export function parseSiteOutline(raw: unknown): SiteOutline | null {
  const root = isRecord(raw) ? raw : null;
  if (!root) return null;

  const pageGoal = asTrimmedString(root.pageGoal) || "Convert visitors on a single home page.";
  const modulesRaw = Array.isArray(root.modules) ? root.modules : null;
  if (!modulesRaw || modulesRaw.length === 0) return null;

  const usedIds = new Set<string>();
  const modules: SiteOutlineModule[] = [];

  for (let i = 0; i < modulesRaw.length; i += 1) {
    const item = modulesRaw[i];
    if (!isRecord(item)) continue;

    const typeRaw = asTrimmedString(item.type) || "custom";
    const type: SiteOutlineModuleType = isSiteOutlineModuleType(typeRaw) ? typeRaw : "custom";
    const title = asTrimmedString(item.title) || TYPE_LABELS[type];
    let id = asTrimmedString(item.id) || newModuleId(i);
    if (usedIds.has(id)) id = `${id}_${i + 1}`;
    usedIds.add(id);

    const intent = asTrimmedString(item.intent) || undefined;
    const contentHints = asTrimmedString(item.contentHints) || undefined;

    modules.push({
      id,
      type,
      title,
      ...(intent ? { intent } : {}),
      ...(contentHints ? { contentHints } : {}),
    });
  }

  if (modules.length === 0) return null;

  return {
    pageSlug: "home",
    pageGoal,
    modules,
  };
}

/** Extract JSON object from model output (fenced or raw). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object found");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function createEmptySiteOutline(pageGoal = "Convert visitors on a single home page."): SiteOutline {
  return {
    pageSlug: "home",
    pageGoal,
    modules: [
      {
        id: newModuleId(0),
        type: "hero",
        title: "Hero",
        intent: "Primary value proposition and CTA",
      },
    ],
  };
}

export function createModule(
  type: SiteOutlineModuleType,
  overrides?: Partial<Pick<SiteOutlineModule, "title" | "intent" | "contentHints">>
): SiteOutlineModule {
  return {
    id: newModuleId(0),
    type,
    title: overrides?.title?.trim() || TYPE_LABELS[type],
    ...(overrides?.intent?.trim() ? { intent: overrides.intent.trim() } : {}),
    ...(overrides?.contentHints?.trim()
      ? { contentHints: overrides.contentHints.trim() }
      : {}),
  };
}

/**
 * Feature flag: direction lock gate (default ON).
 * Server: `DIRECTION_LOCK_V1=0` disables.
 * Client: `NEXT_PUBLIC_DIRECTION_LOCK_V1=0` disables (otherwise defaults ON).
 */
export function isDirectionLockV1Enabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_DIRECTION_LOCK_V1?.trim();
  if (pub === "0") return false;
  if (pub === "1") return true;
  return process.env.DIRECTION_LOCK_V1?.trim() !== "0";
}
