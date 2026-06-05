import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { captureExternalReferencePage } from "@/lib/reference/captureExternalReferencePage";
import { buildBrandKitFromCapture } from "@/lib/reference/buildBrandKitFromCapture";
import { executeFetchReferencePage } from "./fetchReferencePageTool";

const MAX_OUT = 14_000;

export const brandKitFromUrlTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "brand_kit_from_url",
    description:
      "When the user provides a brand or marketing site URL, capture the page (viewport + visible text) and return a Markdown **brand kit** brief: palette, typography vibe, tone, UI patterns, and differentiation hints. " +
      "Use when a brand/marketing site URL is available (not image CDN). Silent to the user until you summarize via yield. " +
      "If you already ran `reference_site_digest` on the **same** URL in this turn, prefer reusing that context instead of calling this again unless the user explicitly asks for brand tokens.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute https URL of the brand or reference marketing page.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
};

function clip(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_OUT) return t;
  return `${t.slice(0, MAX_OUT)}\n\n…(truncated)`;
}

function stringifyFetch(r: ToolResult | string): string {
  if (typeof r === "string") return r;
  if (r.success && r.output) return r.output;
  return r.error ?? "unknown error";
}

export const executeBrandKitFromUrl: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
  if (!rawUrl) {
    return { success: false, error: "Missing url" };
  }

  const capture = await captureExternalReferencePage(rawUrl);
  if (!capture.ok) {
    const htmlOnly = await executeFetchReferencePage({ url: rawUrl });
    return {
      success: true,
      output: clip(
        `## Brand kit (HTML-only fallback)\n\n` +
          `Playwright capture failed (${capture.error}). Extracted page metadata/text only — visual palette is unreliable.\n\n` +
          stringifyFetch(htmlOnly)
      ),
    };
  }

  try {
    const md = await buildBrandKitFromCapture({
      finalUrl: capture.finalUrl,
      pageTitle: capture.pageTitle,
      visibleText: capture.visibleText,
      pngBase64: capture.pngBase64,
    });
    return { success: true, output: clip(md) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `brand_kit_from_url failed: ${msg}`,
    };
  }
};
