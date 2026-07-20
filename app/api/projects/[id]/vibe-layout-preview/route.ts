import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { loadStepModelsFromDB } from "@/lib/config/models";
import { generateVibeLayoutPreview } from "@/lib/studio/generateVibeLayoutPreview";
import { layoutVariantIdForIndex } from "@/lib/studio/layoutVariant";
import type { VibeDirection } from "@/lib/studio/vibeDirections";
import { VIBE_DIRECTIONS } from "@/lib/studio/vibeDirections";

type Params = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function coerceVibe(raw: unknown): VibeDirection | null {
  if (!isRecord(raw)) return null;
  const fallback = VIBE_DIRECTIONS[0]!;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fallback.id;
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : fallback.label;
  const tagline =
    typeof raw.tagline === "string" && raw.tagline.trim() ? raw.tagline.trim() : fallback.tagline;
  const tokens = isRecord(raw.tokens) ? { ...fallback.tokens, ...raw.tokens } : fallback.tokens;
  const moods = Array.isArray(raw.moods)
    ? raw.moods.filter((m): m is string => typeof m === "string").slice(0, 6)
    : fallback.moods;
  return {
    id,
    label,
    tagline,
    moods: moods.length > 0 ? moods : fallback.moods,
    tokens: tokens as VibeDirection["tokens"],
    styleGuide: typeof raw.styleGuide === "string" ? raw.styleGuide : fallback.styleGuide,
    designIntentMarkdown:
      typeof raw.designIntentMarkdown === "string"
        ? raw.designIntentMarkdown
        : fallback.designIntentMarkdown,
    technicalKeywords: Array.isArray(raw.technicalKeywords)
      ? raw.technicalKeywords.filter((k): k is string => typeof k === "string")
      : fallback.technicalKeywords,
    layoutVariantId:
      typeof raw.layoutVariantId === "string" && raw.layoutVariantId
        ? (raw.layoutVariantId as VibeDirection["layoutVariantId"])
        : layoutVariantIdForIndex(0),
  };
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const vibe = coerceVibe(body.vibe);
  if (!vibe) {
    return NextResponse.json({ error: "Missing vibe", code: "BAD_REQUEST" }, { status: 400 });
  }

  const briefTitle =
    typeof body.briefTitle === "string" && body.briefTitle.trim()
      ? body.briefTitle.trim()
      : "Your product";
  const briefExcerpt =
    typeof body.briefExcerpt === "string" ? body.briefExcerpt.trim().slice(0, 800) : "";

  try {
    await loadStepModelsFromDB();
    const result = await Promise.race([
      generateVibeLayoutPreview({ vibe, briefTitle, briefExcerpt }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("layout preview timeout")), 12_000);
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        html: result.html,
        layoutVariantId: result.layoutVariantId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: "LAYOUT_PREVIEW_FAILED" },
      { status: 502 }
    );
  }
}
