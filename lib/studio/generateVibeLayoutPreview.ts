import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { getModelForStep } from "@/lib/config/models";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import {
  isLayoutVariantId,
  layoutVariantIdForIndex,
  type LayoutVariantId,
} from "@/lib/studio/layoutVariant";
import type { VibeDirection } from "@/lib/studio/vibeDirections";

const TAILWIND_CDN = "https://cdn.tailwindcss.com";

const SYSTEM = `You generate a single-file HTML preview for a marketing landing hero (one viewport).
Return JSON only: { "html": "<!DOCTYPE html>...", "layoutVariantId": "hero_centered|hero_split|hero_editorial" }.

Hard rules:
- One complete HTML document using Tailwind via <script src="${TAILWIND_CDN}"></script> only.
- No other external scripts, no iframes, no fetch, no inline event handlers (onclick etc).
- One screen: nav + hero + optional thin feature strip. No multi-page.
- Use the provided brand title and vibe tokens (colors, radius, fonts).
- Copy must use the brief title; keep supporting text short.
- Prefer a layout different from a plain centered stack when layoutVariantId is hero_split or hero_editorial.`;

function stripDangerousHtml(html: string): string {
  let out = html;
  out = out.replace(/<script(?![^>]*cdn\.tailwindcss\.com)[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/javascript:/gi, "");
  if (!/cdn\.tailwindcss\.com/i.test(out) && /<html/i.test(out)) {
    out = out.replace(
      /<head([^>]*)>/i,
      `<head$1><script src="${TAILWIND_CDN}"><\/script>`
    );
  }
  return out.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type VibeLayoutPreviewResult = {
  html: string;
  layoutVariantId: LayoutVariantId;
};

export async function generateVibeLayoutPreview(params: {
  vibe: VibeDirection;
  briefTitle: string;
  briefExcerpt?: string;
}): Promise<VibeLayoutPreviewResult> {
  const { vibe, briefTitle, briefExcerpt } = params;
  const model = getModelForStep("generate_vibe_directions");
  const userPayload = JSON.stringify({
    title: briefTitle.slice(0, 80),
    excerpt: (briefExcerpt ?? "").slice(0, 600),
    vibe: {
      label: vibe.label,
      tagline: vibe.tagline,
      moods: vibe.moods,
      tokens: vibe.tokens,
      layoutVariantId: vibe.layoutVariantId,
    },
    instruction:
      "Produce a distinct one-viewport HTML mock. Rotate layout away from the previous shell if possible.",
  });

  const meta = await callLLMWithMeta(SYSTEM, userPayload, 0.55, 4096, model, {
    langfuseName: lfPlain(LfPlain.generateVibeDirections),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(meta.content));
  } catch {
    throw new Error("layout preview JSON parse failed");
  }

  const root = isRecord(parsed) ? parsed : {};
  const htmlRaw = typeof root.html === "string" ? root.html.trim() : "";
  if (!htmlRaw || htmlRaw.length < 40) {
    throw new Error("layout preview missing html");
  }
  const layoutRaw = typeof root.layoutVariantId === "string" ? root.layoutVariantId : "";
  const layoutVariantId = isLayoutVariantId(layoutRaw)
    ? layoutRaw
    : vibe.layoutVariantId || layoutVariantIdForIndex(0);

  return {
    html: stripDangerousHtml(htmlRaw),
    layoutVariantId,
  };
}
