import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { executeWebSearch } from "./webSearchTool";
import { executeFetchReferencePage } from "./fetchReferencePageTool";

const MAX_OUT = 14_000;
const MAX_SEARCHES = 3;
const MAX_URL_FETCHES = 2;

export const competitiveLandscapeSnapshotTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "competitive_landscape_snapshot",
    description:
      "Build a **compact** Markdown snapshot of the competitive landscape: DuckDuckGo instant answers + optional safe fetches for user-supplied competitor URLs. " +
      "Use when the user mentions competitors, benchmarks, differentiation, or \"who else does X\". " +
      "Facts may be incomplete — label uncertainty. After this tool, **yield** to the user with options; do **not** silently insert unverified competitor claims into `merged_brief` unless the user confirms.",
    parameters: {
      type: "object",
      properties: {
        industry_or_product: {
          type: "string",
          description: "What space or product category to scan (e.g. \"AI website builder for SMB\").",
        },
        competitor_hints: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: up to 4 brand names, domains, or https URLs the user mentioned. URLs are fetched with SSRF checks.",
        },
        differentiation_goal: {
          type: "string",
          description: "Optional: how the user wants to differ (one short phrase).",
        },
      },
      required: ["industry_or_product"],
      additionalProperties: false,
    },
  },
};

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

async function runSearch(query: string): Promise<string> {
  const r = await executeWebSearch({ query });
  if (typeof r === "string") return r;
  if (r.success && r.output) return r.output;
  return r.error ?? "(search error)";
}

function clip(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_OUT) return t;
  return `${t.slice(0, MAX_OUT)}\n\n…(truncated)`;
}

export const executeCompetitiveLandscapeSnapshot: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const industry =
    typeof args.industry_or_product === "string" ? args.industry_or_product.trim() : "";
  if (!industry) {
    return { success: false, error: "Missing industry_or_product" };
  }
  const diff =
    typeof args.differentiation_goal === "string" && args.differentiation_goal.trim()
      ? args.differentiation_goal.trim()
      : "";
  const hintsRaw = Array.isArray(args.competitor_hints) ? args.competitor_hints : [];
  const hints = hintsRaw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const lines: string[] = [];
  lines.push("## Competitive landscape snapshot");
  lines.push("");
  lines.push(
    "> Sources: DuckDuckGo instant answers and optional page excerpts. May be incomplete; **verify** before marketing claims."
  );
  lines.push("");
  lines.push(`### Focus`);
  lines.push(`- ${industry}`);
  if (diff) {
    lines.push(`- Differentiation goal (user): ${diff}`);
  }
  lines.push("");

  const searchQueries: string[] = [`${industry} alternatives`, `${industry} competitors`];
  const brandHints = hints.filter((h) => !isHttpUrl(h)).slice(0, 2);
  for (const b of brandHints) {
    searchQueries.push(`${b} product overview`);
  }

  const usedQueries = searchQueries.slice(0, MAX_SEARCHES);
  lines.push("### Search snippets");
  for (let i = 0; i < usedQueries.length; i++) {
    const q = usedQueries[i];
    lines.push(`#### Query ${i + 1}: ${q}`);
    try {
      const body = await runSearch(q);
      lines.push(body);
    } catch (e) {
      lines.push(`(error: ${e instanceof Error ? e.message : String(e)})`);
    }
    lines.push("");
  }

  const urls = hints.filter((h) => isHttpUrl(h)).slice(0, MAX_URL_FETCHES);
  if (urls.length > 0) {
    lines.push("### User-supplied URLs (excerpt)");
    for (const url of urls) {
      lines.push(`#### ${url}`);
      const r = await executeFetchReferencePage({ url });
      const text = typeof r === "string" ? r : r.success && r.output ? r.output : r.error ?? "";
      lines.push(text.slice(0, 6_000) + (text.length > 6_000 ? "\n\n…(truncated)" : ""));
      lines.push("");
    }
  }

  lines.push("### Suggested angles (for you to confirm with user)");
  lines.push(
    "- Summarize 2–3 **differentiation** directions that fit the user’s goal and avoid copying one competitor verbatim."
  );
  lines.push("- Ask which competitor (if any) is closest to what they want to **emulate** vs **contrast**.");

  return { success: true, output: clip(lines.join("\n")) };
};
