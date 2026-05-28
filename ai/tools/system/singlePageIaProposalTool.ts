import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { callLLMWithMeta } from "@/ai/flows/generate_project/shared/llm";
import { getModelForStep } from "@/lib/config/models";
import { lfPlain } from "@/lib/observability/langfuseGenerationCatalog";

const MAX_OUT = 14_000;

export const singlePageIaProposalTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "single_page_ia_proposal",
    description:
      "When the user's product direction is known but **section order on the home route `/`** is still fuzzy, propose a landing-page IA (sections top→bottom, CTAs). " +
      "Best for storytelling / marketing sites centered on one scroll on `/`. " +
      "If the user clearly wants **multiple top-level routes** (e.g. dashboard + settings, docs tree, separate campaign pages), sketch those routes in conversation and `merged_brief`; do not tell the user the pipeline only supports one page. " +
      "Output is Markdown for your reasoning only — compress for the user in `yield_to_user`.",
    parameters: {
      type: "object",
      properties: {
        product_summary: {
          type: "string",
          description: "One short paragraph: what the user is building and for whom (from conversation).",
        },
        audience: {
          type: "string",
          description: "Optional target audience if known.",
        },
        constraints_or_notes: {
          type: "string",
          description: "Optional: reference digest excerpt, brand notes, or things to avoid.",
        },
      },
      required: ["product_summary"],
      additionalProperties: false,
    },
  },
};

const SYSTEM = `You plan **section order and messaging flow for the primary landing at /** (slug \`home\`) in a Next.js App Router site.

The wider blueprint may later include **additional top-level routes** if the user's product needs them — this Markdown is **only** the main landing scroll. If the user's ask is inherently multi-route with no meaningful long landing at \`/\`, say so briefly in **Open decisions** and propose a minimal \`/\` stub only.

Return Markdown only, with this structure:

## Page goal
One sentence.

## Section order (top → bottom)
Numbered list. Each item: **Name** — 1–2 sentences what it does + key elements (headline, bullets, CTA label idea).

## Primary and secondary CTAs
What the main conversion is; one alternate CTA.

## Optional modules (pick max 3 if space tight)
Short bullets: pricing table, FAQ, testimonials, logo wall, etc. Say which fit this product.

## Open decisions
What still needs user input.

Be conservative: do not invent product mechanics the user did not imply. Match the user's language for proper nouns.`;

export const executeSinglePageIaProposal: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const product =
    typeof args.product_summary === "string" ? args.product_summary.trim() : "";
  if (!product) {
    return { success: false, error: "Missing product_summary" };
  }
  const audience =
    typeof args.audience === "string" && args.audience.trim() ? args.audience.trim() : "(unknown)";
  const notes =
    typeof args.constraints_or_notes === "string" && args.constraints_or_notes.trim()
      ? args.constraints_or_notes.trim()
      : "(none)";

  const user = `product_summary:\n${product}\n\naudience:\n${audience}\n\nnotes:\n${notes}`;

  try {
    const model = getModelForStep("intent_ia_proposal");
    const { content } = await callLLMWithMeta(
      SYSTEM,
      user,
      0.35,
      2_500,
      model,
      { langfuseName: lfPlain("intent_single_page_ia") }
    );
    const out = content.trim();
    if (!out) {
      return { success: false, error: "Empty IA proposal from model" };
    }
    const clipped = out.length > MAX_OUT ? `${out.slice(0, MAX_OUT)}\n\n…(truncated)` : out;
    return { success: true, output: clipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `single_page_ia_proposal failed: ${msg}` };
  }
};
