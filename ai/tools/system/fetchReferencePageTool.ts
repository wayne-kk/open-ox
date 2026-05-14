import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { assertUrlSafeForServerFetch } from "@/lib/net/safePublicUrl";

const MAX_BYTES = 1_800_000;
const MAX_EXCERPT_CHARS = 14_000;
const MAX_REDIRECTS = 8;
const FETCH_TIMEOUT_MS = 14_000;

export const fetchReferencePageTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "fetch_reference_page",
    description:
      "Fetch a public web page by URL and return a text summary (title, meta description, key headings, readable excerpt). " +
      "Use when the user gives a reference link or asks to mimic/copy a site's layout or style — do not guess; fetch first. " +
      "Only standard http(s) URLs; redirects are followed if each hop passes safety checks.",
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

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractFromHtml(html: string): {
  title: string;
  description: string;
  headings: string[];
  excerpt: string;
} {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeXmlEntities(titleMatch[1].replace(/\s+/g, " ").trim()) : "";

  let description = "";
  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  if (metaDesc?.[1]) {
    description = decodeXmlEntities(metaDesc[1].replace(/\s+/g, " ").trim());
  }

  const headings: string[] = [];
  const hRe = /<h[1-3][^>]*>([^<]*(?:<(?!\/h[1-3])[^<]*)*)<\/h[1-3]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(html)) !== null && headings.length < 12) {
    const raw = hm[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (raw) headings.push(decodeXmlEntities(raw).slice(0, 200));
  }

  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let excerpt = decodeXmlEntities(stripped);
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    excerpt = `${excerpt.slice(0, MAX_EXCERPT_CHARS)}\n\n…(truncated)`;
  }

  return { title, description, headings, excerpt };
}

async function fetchWithSafeRedirects(startUrl: string): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertUrlSafeForServerFetch(current);

    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "open-ox-reference-fetch/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return res;
      }
      const next = new URL(loc, current).href;
      current = next;
      continue;
    }

    return res;
  }
  throw new Error("Too many redirects");
}

export const executeFetchReferencePage: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
  if (!rawUrl) {
    return { success: false, error: "Missing url" };
  }

  try {
    await assertUrlSafeForServerFetch(rawUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `URL blocked or invalid: ${msg}` };
  }

  try {
    const res = await fetchWithSafeRedirects(rawUrl);

    if (res.status < 200 || res.status >= 400) {
      return {
        success: false,
        error: `HTTP ${res.status} when fetching the page. Proceed without page content.`,
      };
    }

    const ct = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml+xml")) {
      return {
        success: true,
        output: `Fetched URL (${ct}) — not HTML. Cannot extract layout text. Open the link in a browser for reference.`,
      };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return {
        success: false,
        error: "Page body too large to process safely. Try a smaller page or a static URL.",
      };
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const { title, description, headings, excerpt } = extractFromHtml(html);

    const lines: string[] = [];
    lines.push("## Reference page snapshot");
    lines.push(`- **Final URL**: ${res.url}`);
    if (title) lines.push(`- **Title**: ${title}`);
    if (description) lines.push(`- **Meta description**: ${description}`);
    if (headings.length) {
      lines.push(`- **Headings**:\n${headings.map((h) => `  - ${h}`).join("\n")}`);
    }
    if (excerpt.length < 280) {
      lines.push(
        "\n> Note: Very little text was extracted — the site may be a client-rendered SPA. Ask the user for layout clues or key sections if needed."
      );
    }
    lines.push("\n### Visible text (excerpt)\n");
    lines.push(excerpt || "(No extractable text)");

    return {
      success: true,
      output: lines.join("\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Fetch failed: ${msg}. You may ask the user for a different URL or proceed from their description only.`,
    };
  }
};
