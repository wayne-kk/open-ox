/**
 * Multimodal summary of a reference landing page for intent + blueprint steps.
 */

import { chatCompletion } from "@/ai/shared/llm/gateway";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";

const SYSTEM = `You are a product + UI analyst. Given a viewport screenshot and visible text from a reference website, produce a concise Markdown brief for an AI that will build a **new** similar (not identical) single-page marketing site.

Output Markdown with these sections:
## Site purpose (inferred)
What this business/product appears to be (one short paragraph). Name the sector (e.g. AI website builder, SaaS analytics) if clear.

## Layout & sections (viewport + text)
Ordered list of visible sections (hero, feature grid, testimonials, pricing, CTA, footer, etc.).

## Visual style
Colors, contrast, gradients, spacing density, typography vibe, motion/implied energy, notable UI patterns (e.g. bento/cards, glass, neon accents).

## Copy themes
Headline tone and key value props visible (short bullets).

## Gaps / unclear
What is NOT visible or ambiguous (if any).

Be faithful to the screenshot and text; do not invent features not hinted at.`;

export async function buildVisionReferenceDigest(params: {
  finalUrl: string;
  pageTitle: string;
  visibleText: string;
  pngBase64: string;
}): Promise<string> {
  const model = getModelForStep("reference_site_digest");
  const thinking = getThinkingLevelForStep("reference_site_digest");

  const user: ChatMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text:
          `Reference URL (after redirects): ${params.finalUrl}\n` +
          `Document title: ${params.pageTitle || "(none)"}\n\n` +
          `Visible text (may be long; use with screenshot):\n${params.visibleText || "(empty)"}`,
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${params.pngBase64}`,
          detail: "high",
        },
      },
    ],
  };

  const res = await chatCompletion({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      user,
    ],
    temperature: 0.2,
    max_tokens: 2_500,
    ...(thinking ? { thinking_level: thinking } : {}),
    langfuseGenerationName: "oxgen.reference_site_digest.vision",
    langfuseGenerationMetadata: { referenceUrl: params.finalUrl },
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("reference_site_digest: empty vision model output");
  }
  return text;
}
