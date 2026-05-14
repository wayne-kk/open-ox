import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { executeFetchReferencePage } from "./fetchReferencePageTool";
import { captureExternalReferencePage } from "@/lib/reference/captureExternalReferencePage";
import { buildVisionReferenceDigest } from "@/lib/reference/visionReferenceDigest";

export const referenceSiteDigestTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "reference_site_digest",
    description:
      "Primary tool when the user pastes a reference http(s) URL. " +
      "Loads the page in a real browser (viewport screenshot), extracts visible text (works for SPAs), runs multimodal analysis, and returns a Markdown digest of purpose, layout sections, and visual style. " +
      "Always call this before yield/commit when a reference link is present (unless this tool already ran in-session for the same URL). " +
      "Do not substitute with memory — use this tool.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute URL, e.g. https://example.com/",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
};

function stringifyFetchResult(r: ToolResult | string): string {
  if (typeof r === "string") return r;
  if (r.success && r.output) return r.output;
  return r.error ?? "unknown error";
}

export const executeReferenceSiteDigest: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
  if (!rawUrl) {
    return { success: false, error: "Missing url" };
  }

  const capture = await captureExternalReferencePage(rawUrl);
  if (!capture.ok) {
    const htmlOnly = await executeFetchReferencePage(args);
    const body = stringifyFetchResult(htmlOnly);
    return {
      success: true,
      output:
        `## Reference digest (HTML-only fallback)\n` +
        `Playwright capture was unavailable (${capture.error}). Used HTTP fetch instead.\n\n` +
        body,
    };
  }

  try {
    const vision = await buildVisionReferenceDigest({
      finalUrl: capture.finalUrl,
      pageTitle: capture.pageTitle,
      visibleText: capture.visibleText,
      pngBase64: capture.pngBase64,
    });

    const lines: string[] = [];
    lines.push("## Reference digest (viewport screenshot + visible text + vision analysis)");
    lines.push(`- **Final URL**: ${capture.finalUrl}`);
    lines.push("");
    lines.push(vision);
    lines.push("");
    lines.push("### Raw visible text (for traceability, excerpt may repeat)");
    lines.push(capture.visibleText || "(empty)");

    return { success: true, output: lines.join("\n") };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const htmlOnly = await executeFetchReferencePage(args);
    const body = stringifyFetchResult(htmlOnly);
    return {
      success: true,
      output:
        `## Reference digest (partial fallback)\n` +
        `Vision summary failed (${msg}). Using browser-visible text + HTML snapshot.\n\n` +
        `### Visible text from browser\n${capture.visibleText}\n\n` +
        `### HTML snapshot\n${body}`,
    };
  }
};
