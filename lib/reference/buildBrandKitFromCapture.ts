/**
 * Vision model extracts brand-oriented tokens from the same capture used by reference_site_digest.
 */

import { chatCompletion } from "@/ai/shared/llm/gateway";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";

const SYSTEM = `You are a brand + UI systems analyst. From the viewport screenshot and visible text of a **reference** website, extract signals useful to design a **new** single-page landing site inspired by (not copying) this brand.

Output **only** Markdown with this structure:

## Palette (inferred)
- Primary / accent colors as plain language (e.g. "deep blue + electric cyan"). Mark "(inferred)" where uncertain.
- Light/dark bias and contrast impression.

## Typography & layout density
- Font personality (e.g. geometric sans, editorial serif) and approximate density (airy / balanced / dense).

## Tone of voice
- 2–4 adjectives for copy tone; note formality level.

## Logo / imagery
- How prominent is the mark; photography vs illustration vs abstract gradients.

## Patterns to echo (new site)
- 2–5 concrete UI patterns worth echoing (e.g. gradient hero, bento grid, social proof row).

## Avoid (differentiation)
- What a **new** product should avoid copying literally to prevent clone perception.

Be faithful to the screenshot/text; do not invent products or claims not hinted at.`;

export async function buildBrandKitFromCapture(params: {
  finalUrl: string;
  pageTitle: string;
  visibleText: string;
  pngBase64: string;
}): Promise<string> {
  const model = getModelForStep("intent_brand_kit");
  const thinking = getThinkingLevelForStep("intent_brand_kit");

  const user: ChatMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text:
          `URL (after redirects): ${params.finalUrl}\n` +
          `Title: ${params.pageTitle || "(none)"}\n\n` +
          `Visible text:\n${params.visibleText || "(empty)"}`,
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
    temperature: 0.25,
    max_tokens: 2_000,
    ...(thinking ? { thinking_level: thinking } : {}),
    langfuseGenerationName: "oxgen.intent.brand_kit.vision",
    langfuseGenerationMetadata: { url: params.finalUrl },
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("brand_kit_from_url: empty model output");
  }
  return text;
}
