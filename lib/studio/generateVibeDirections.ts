import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { getModelForStep } from "@/lib/config/models";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import {
  VIBE_DIRECTIONS,
  type VibeDirection,
  type VibeTokenPreview,
} from "@/lib/studio/vibeDirections";
import { normalizeVibeTokensForContrast } from "@/lib/studio/vibeTokenContrast";

const INPUT_CLIP = 6000;
const OUTPUT_MAX_TOKENS = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clipForPrompt(s: string): string {
  const t = s.trim();
  if (t.length <= INPUT_CLIP) return t;
  return `${t.slice(0, INPUT_CLIP)}…`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function asHex(value: unknown, fallback: string): string {
  const s = asString(value);
  return HEX_RE.test(s) ? s : fallback;
}

function parseTokens(raw: unknown, fallback: VibeTokenPreview): VibeTokenPreview {
  const t = isRecord(raw) ? raw : {};
  const parsed: VibeTokenPreview = {
    background: asHex(t.background, fallback.background),
    foreground: asHex(t.foreground, fallback.foreground),
    muted: asHex(t.muted, fallback.muted),
    accent: asHex(t.accent, fallback.accent),
    accentForeground: asHex(t.accentForeground, fallback.accentForeground),
    border: asHex(t.border, fallback.border),
    fontDisplay: asString(t.fontDisplay, fallback.fontDisplay) || fallback.fontDisplay,
    fontBody: asString(t.fontBody, fallback.fontBody) || fallback.fontBody,
    radius: asString(t.radius, fallback.radius) || fallback.radius,
  };
  // LLM muted is often aesthetic gray that fails WCAG on the chosen background.
  return normalizeVibeTokensForContrast(parsed);
}

function buildStyleGuide(params: {
  label: string;
  tagline: string;
  paletteNote: string;
  typographyNote: string;
  decorationNote: string;
  imageryNote: string;
  forbidden: string[];
}): string {
  const lines = [
    `Direction: ${params.label} — ${params.tagline}`,
    `Palette: ${params.paletteNote || params.tagline}`,
    `Typography: ${params.typographyNote || "Pair display/body for clear hierarchy."}`,
    `Decoration: ${params.decorationNote || "Keep ornament intentional and sparse."}`,
    `Imagery: ${params.imageryNote || "Use product/context photography aligned to the brand."}`,
  ];
  if (params.forbidden.length > 0) {
    lines.push(`Forbidden: ${params.forbidden.join("; ")}`);
  }
  return lines.join("\n");
}

function buildDesignIntentMarkdown(params: {
  mood: string;
  colorDirection: string;
  style: string;
  keywords: string[];
}): string {
  const keywords =
    params.keywords.length > 0 ? params.keywords.join(", ") : params.style || "brand, visual";
  return `## Design Intent
- Mood: ${params.mood || "intentional, coherent"}
- Color Direction: ${params.colorDirection || "Brief-aligned palette with one clear accent."}
- Style: ${params.style || "product-specific"}
- Keywords: ${keywords}
`;
}

function slugifyId(raw: string, index: number): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `direction-${index + 1}`;
}

/**
 * Pure parse after {@link extractJSON} — returns null when the payload is not usable.
 */
export function parseGenerateVibeDirectionsPayload(parsed: unknown): VibeDirection[] | null {
  const root = isRecord(parsed) ? parsed : {};
  const list = Array.isArray(root.directions) ? root.directions : null;
  if (!list || list.length < 3) return null;

  const usedIds = new Set<string>();
  const directions: VibeDirection[] = [];

  for (let i = 0; i < 3; i += 1) {
    const item = list[i];
    if (!isRecord(item)) return null;

    const label = asString(item.label);
    const tagline = asString(item.tagline);
    if (!label || !tagline) return null;

    const fallbackTokens = VIBE_DIRECTIONS[i]?.tokens ?? VIBE_DIRECTIONS[0]!.tokens;
    let id = slugifyId(asString(item.id) || label, i);
    if (usedIds.has(id)) id = `${id}-${i + 1}`;
    usedIds.add(id);

    const moods = asStringList(item.moods, 4);
    const keywords = asStringList(item.keywords, 8);
    const forbidden = asStringList(item.forbidden, 8);
    const mood = asString(item.mood) || moods.join(", ");
    const colorDirection = asString(item.colorDirection);
    const style = asString(item.style);
    const tokens = parseTokens(item.tokens, fallbackTokens);

    directions.push({
      id,
      label,
      tagline,
      moods: moods.length > 0 ? moods : [label],
      tokens,
      styleGuide: buildStyleGuide({
        label,
        tagline,
        paletteNote: asString(item.paletteNote),
        typographyNote: asString(item.typographyNote),
        decorationNote: asString(item.decorationNote),
        imageryNote: asString(item.imageryNote),
        forbidden,
      }),
      designIntentMarkdown: buildDesignIntentMarkdown({
        mood,
        colorDirection,
        style,
        keywords,
      }),
      technicalKeywords:
        keywords.length > 0
          ? keywords.map((k) => k.toLowerCase())
          : [style || label].filter(Boolean).map((k) => k.toLowerCase()),
    });
  }

  return directions;
}

export type GenerateVibeDirectionsResult = {
  directions: VibeDirection[];
  source: "llm" | "fallback";
};

/**
 * Brief-sensitive vibe forks. Falls back to {@link VIBE_DIRECTIONS} on LLM/parse failure.
 */
export async function generateVibeDirections(
  briefMarkdown: string
): Promise<GenerateVibeDirectionsResult> {
  const brief = briefMarkdown.trim();
  if (!brief) {
    return { directions: VIBE_DIRECTIONS, source: "fallback" };
  }

  try {
    const model = getModelForStep("generate_vibe_directions");
    const systemPrompt = composePromptBlocks([
      loadStepPrompt("generateVibeDirections"),
      loadGuardrail("outputJson"),
    ]);
    const userPayload = JSON.stringify({
      brief_markdown: clipForPrompt(brief),
      count: 3,
      instruction:
        "Produce three brief-specific visual directions. Do not always reuse cold-tech / warm-editorial / bold-promo.",
    });

    const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.45, OUTPUT_MAX_TOKENS, model, {
      langfuseName: lfPlain(LfPlain.generateVibeDirections),
    });

    const parsed = JSON.parse(extractJSON(meta.content));
    const directions = parseGenerateVibeDirectionsPayload(parsed);
    if (!directions) {
      return { directions: VIBE_DIRECTIONS, source: "fallback" };
    }
    return { directions, source: "llm" };
  } catch {
    return { directions: VIBE_DIRECTIONS, source: "fallback" };
  }
}
