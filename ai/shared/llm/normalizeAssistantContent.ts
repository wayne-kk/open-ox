/**
 * OpenAI Chat Completions usually return `choices[0].message.content` as a string,
 * but some Gemini-compatible gateways return an array of `{ type: "text", text }` parts.
 * Normalizes either shape to a single string for downstream parsing.
 */
export function normalizeAssistantTextContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        chunks.push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const t =
          typeof o.text === "string"
            ? o.text
            : typeof o.content === "string"
              ? o.content
              : "";
        if (t) chunks.push(t);
      }
    }
    return chunks.join("\n").trim();
  }
  return String(content).trim();
}
