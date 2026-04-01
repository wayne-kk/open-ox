import {
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractContent, extractJSON } from "../shared/llm";

function looksLikeGlobalsCss(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  return (
    /@import|@theme|@layer|@tailwindcss|@keyframes/.test(t) ||
    (t.includes("{") && t.includes("}") && /:\s*root|--color-|--font-/.test(t))
  );
}

/**
 * Prefer a ```css fence: embedding full CSS inside JSON breaks on quotes, braces,
 * and long output; fenced CSS avoids escaping and truncation confusion.
 * Fallback: legacy `{ "globals_css": "..." }` for older prompts.
 */
function parseDesignTokensResponse(raw: string): string {
  const trimmed = raw.trim();

  const fromCssFence = extractContent(trimmed, "css");
  if (looksLikeGlobalsCss(fromCssFence)) {
    return fromCssFence.trim();
  }

  // Try generic fence if model used ``` without css tag
  const anyFence = extractContent(trimmed, "");
  if (anyFence !== trimmed && looksLikeGlobalsCss(anyFence)) {
    return anyFence.trim();
  }

  if (looksLikeGlobalsCss(trimmed)) {
    return trimmed;
  }

  try {
    const jsonStr = extractJSON(trimmed);
    const parsed = JSON.parse(jsonStr) as { globals_css?: unknown };
    if (typeof parsed.globals_css === "string" && parsed.globals_css.trim().length > 0) {
      return parsed.globals_css.trim();
    }
  } catch {
    /* fall through */
  }

  const preview = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  throw new Error(
    `apply_project_design_tokens: could not parse model output as CSS or JSON globals_css.\nPreview:\n${preview}`
  );
}

export async function stepApplyProjectDesignTokens(
  designSystem: string
): Promise<string[]> {
  const currentGlobalsCss = readSiteFile("app/globals.css");

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("applyProjectDesignTokens"),
  ].join("");

  const userMessage = `## Design System
${designSystem}

## Current globals.css
\`\`\`css
${currentGlobalsCss}
\`\`\`

Generate the updated globals.css using Tailwind CSS v4 syntax.`;

  // No max_tokens limit — let the model output the complete CSS without truncation
  const raw = await callLLM(systemPrompt, userMessage, 0.3);
  const globalsCss = parseDesignTokensResponse(raw);

  await writeSiteFile("app/globals.css", globalsCss);
  return ["app/globals.css"];
}
