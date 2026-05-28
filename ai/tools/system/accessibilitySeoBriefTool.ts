import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { callLLMWithMeta } from "@/ai/flows/generate_project/shared/llm";
import { getModelForStep } from "@/lib/config/models";
import { lfPlain } from "@/lib/observability/langfuseGenerationCatalog";

const MAX_OUT = 12_000;

export const accessibilitySeoBriefTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "accessibility_and_seo_brief",
    description:
      "Produce a **short** Markdown checklist for basic accessibility and on-page SEO tailored to the user's **planned Next.js routes** (often a single landing `/`, sometimes several top-level pages). " +
      "Call when the user cares about launch quality, SEO, or compliance-ish basics, or before `confirm_brief`. " +
      "Silent to the user until you summarize; do not treat this as legal advice.",
    parameters: {
      type: "object",
      properties: {
        site_goal: {
          type: "string",
          description: "What the page should achieve (conversion, signup, portfolio, etc.).",
        },
        proposed_sections: {
          type: "string",
          description: "Comma or newline list of planned sections (hero, pricing, FAQ, …).",
        },
        brand_or_product_name: {
          type: "string",
          description: "Optional brand/product name for title ideas.",
        },
      },
      required: ["site_goal", "proposed_sections"],
      additionalProperties: false,
    },
  },
};

const SYSTEM = `You write a practical **checklist** for a small Next.js site: often one marketing landing at \`/\`, but the user may outline **several top-level routes**. Cover shared patterns; if multiple routes were implied, add a short subsection on **per-route title/h1 discipline** and internal links.

Output Markdown only:

## Page metadata suggestions
- 2–3 candidate <title> patterns for the **primary** page (not final law; user may edit); if multiple routes, one line each for key secondary pages
- Meta description pattern (length hint)

## Heading structure
- One logical \`h1\` **per route** (for a single-scroll landing that is still one page); sensible \`h2\`/order for the sections listed; if multiple routes, remind not to reuse the same topic as multiple h1s across pages unintentionally.

## Images & media
- Alt text habits; decorative vs informative

## Accessibility (non-exhaustive)
- Contrast, focus states, motion, form labels if any — short bullets

## SEO / share
- Open Graph / social preview reminders if the stack supports it (generic)

## Do not
- Claim WCAG certification or legal compliance; say "consider reviewing with experts" if relevant.

Keep the entire output under ~900 words. Use the user's language for examples if they wrote in Chinese, use Chinese section titles.`;

export const executeAccessibilitySeoBrief: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const goal = typeof args.site_goal === "string" ? args.site_goal.trim() : "";
  const sections =
    typeof args.proposed_sections === "string" ? args.proposed_sections.trim() : "";
  if (!goal || !sections) {
    return { success: false, error: "Missing site_goal or proposed_sections" };
  }
  const brand =
    typeof args.brand_or_product_name === "string" && args.brand_or_product_name.trim()
      ? args.brand_or_product_name.trim()
      : "(none)";

  const user = `site_goal:\n${goal}\n\nsections:\n${sections}\n\nbrand:\n${brand}`;

  try {
    const model = getModelForStep("intent_a11y_seo");
    const { content } = await callLLMWithMeta(
      SYSTEM,
      user,
      0.3,
      1_800,
      model,
      { langfuseName: lfPlain("intent_accessibility_seo_brief") }
    );
    const out = content.trim();
    if (!out) {
      return { success: false, error: "Empty a11y/SEO brief" };
    }
    const clipped = out.length > MAX_OUT ? `${out.slice(0, MAX_OUT)}\n\n…(truncated)` : out;
    return { success: true, output: clipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `accessibility_and_seo_brief failed: ${msg}` };
  }
};
