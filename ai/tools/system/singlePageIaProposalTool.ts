import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { callLLMWithMeta } from "@/ai/flows/generate_project/shared/llm";
import { getModelForStep } from "@/lib/config/models";
import { lfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import {
  extractJsonObject,
  parseSiteOutline,
  type SiteOutline,
} from "@/lib/studio/siteOutline";

const MAX_OUT = 14_000;

export const singlePageIaProposalTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "single_page_ia_proposal",
    description:
      "Propose a **single-page** information architecture as structured SiteOutline JSON " +
      "(section order, titles, intents). Call after the product goal is clear — typically before " +
      "`yield_to_user(kind=confirm_direction)`. Respects pipeline: one `home` page only.",
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

const SYSTEM = `You plan a **single** marketing/home page (one URL) for Next.js. The downstream builder only creates one page slug \`home\` at /.

Return **JSON only** (no markdown prose outside JSON) with this shape:
{
  "pageSlug": "home",
  "pageGoal": "one sentence page goal",
  "modules": [
    {
      "id": "mod_1",
      "type": "hero|logo_cloud|features|how_it_works|testimonials|pricing|faq|cta|footer|custom",
      "title": "short label for the wireframe",
      "intent": "1-2 sentences what this block does",
      "contentHints": "optional key elements / copy hints"
    }
  ]
}

Rules:
- 4–8 modules typical; always include a hero near the top.
- Do not invent product mechanics the user did not imply.
- Match the user's language for proper nouns in titles/intents.
- pageSlug must be "home".`;

export type SinglePageIaProposalSuccess = {
  success: true;
  output: string;
  siteOutline: SiteOutline;
};

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
    const { content } = await callLLMWithMeta(SYSTEM, user, 0.35, 2_500, model, {
      langfuseName: lfPlain("intent_single_page_ia"),
    });
    const out = content.trim();
    if (!out) {
      return { success: false, error: "Empty IA proposal from model" };
    }
    const parsed = extractJsonObject(out);
    const siteOutline = parseSiteOutline(parsed);
    if (!siteOutline) {
      return {
        success: false,
        error: "single_page_ia_proposal: model JSON failed SiteOutline validation",
      };
    }
    const serialized = JSON.stringify(siteOutline, null, 2);
    const clipped =
      serialized.length > MAX_OUT ? `${serialized.slice(0, MAX_OUT)}\n\n…(truncated)` : serialized;
    return { success: true, output: clipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `single_page_ia_proposal failed: ${msg}` };
  }
};
