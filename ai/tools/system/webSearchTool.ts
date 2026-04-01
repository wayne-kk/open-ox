import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";

export const webSearchTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "web_search",
        description:
            "Search the web for information about a topic, brand, person, product, or event that you are unfamiliar with. Use this when the user's request contains proper nouns, brand names, or domain-specific terms you don't recognize.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query. Be specific — include the brand/person/product name.",
                },
            },
            required: ["query"],
        },
    },
};

export const executeWebSearch: ToolExecutor = async (
    args: Record<string, unknown>
): Promise<ToolResult | string> => {
    const query = args.query as string;
    if (!query) return { success: false, error: "Missing query" };

    try {
        // Use DuckDuckGo Instant Answer API (no key required)
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, {
            headers: { "User-Agent": "open-ox/1.0" },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            return { success: false, error: `HTTP ${res.status}` };
        }

        const data = await res.json() as {
            AbstractText?: string;
            AbstractSource?: string;
            AbstractURL?: string;
            RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
            Answer?: string;
            Heading?: string;
        };

        const parts: string[] = [];

        if (data.Heading) parts.push(`**${data.Heading}**`);
        if (data.Answer) parts.push(`Answer: ${data.Answer}`);
        if (data.AbstractText) {
            parts.push(`${data.AbstractText}`);
            if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource} (${data.AbstractURL})`);
        }

        // Add top related topics
        const topics = (data.RelatedTopics ?? [])
            .slice(0, 5)
            .filter((t) => t.Text)
            .map((t) => `- ${t.Text}`);
        if (topics.length > 0) {
            parts.push(`\nRelated:\n${topics.join("\n")}`);
        }

        const output = parts.join("\n\n").trim();

        if (!output) {
            return {
                success: true,
                output: `No instant answer found for "${query}". The term may be too niche or regional. Proceed with best-effort interpretation.`,
            };
        }

        return { success: true, output };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            error: `Web search failed: ${msg}. Proceed without search results.`,
        };
    }
};
