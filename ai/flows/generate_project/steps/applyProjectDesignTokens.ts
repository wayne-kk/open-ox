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

function parseDesignTokensResponse(raw: string): string {
  const trimmed = raw.trim();

  const fromCssFence = extractContent(trimmed, "css");
  if (looksLikeGlobalsCss(fromCssFence)) return fromCssFence.trim();

  const anyFence = extractContent(trimmed, "");
  if (anyFence !== trimmed && looksLikeGlobalsCss(anyFence)) return anyFence.trim();

  if (looksLikeGlobalsCss(trimmed)) return trimmed;

  try {
    const jsonStr = extractJSON(trimmed);
    const parsed = JSON.parse(jsonStr) as { globals_css?: unknown };
    if (typeof parsed.globals_css === "string" && parsed.globals_css.trim().length > 0) {
      return parsed.globals_css.trim();
    }
  } catch { /* fall through */ }

  const preview = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  throw new Error(
    `apply_project_design_tokens: could not parse model output as CSS or JSON.\nPreview:\n${preview}`
  );
}

/**
 * Extract only the @theme block from globals.css (the part the model needs to see).
 * This dramatically reduces prompt size and output size.
 */
function extractThemeBlock(css: string): string {
  const themeMatch = css.match(/@theme\s*(inline\s*)?\{/);
  if (!themeMatch) return "";
  const start = themeMatch.index!;
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return css.slice(start, end);
}

function extractRootVars(css: string): string {
  // Extract :root { ... } block from @layer base
  const rootMatch = css.match(/:root\s*\{[^}]*\}/);
  return rootMatch ? rootMatch[0] : "";
}

export async function stepApplyProjectDesignTokens(
  designSystem: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  const currentGlobalsCss = readSiteFile("app/globals.css");
  const currentTheme = extractThemeBlock(currentGlobalsCss);
  const currentRoot = extractRootVars(currentGlobalsCss);

  onProgress?.("reading design system + current tokens...");

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("applyProjectDesignTokens"),
  ].join("");

  // Send only the relevant parts, not the entire file
  const userMessage = `## Design System
${designSystem}

## Current @theme block
\`\`\`css
${currentTheme || "/* empty — no @theme block yet */"}
\`\`\`

## Current :root variables
\`\`\`css
${currentRoot || "/* empty */"}
\`\`\`

## Current globals.css structure (for reference — preserve imports, base styles, scrollbar styles)
\`\`\`css
${currentGlobalsCss}
\`\`\`

Generate the complete updated globals.css. Be concise — output only the CSS code block, no explanation.`;

  onProgress?.("calling LLM to generate design tokens...");
  const t0 = Date.now();

  const raw = await callLLM(systemPrompt, userMessage, 0.3);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  onProgress?.(`LLM responded in ${elapsed}s, parsing CSS...`);

  const globalsCss = parseDesignTokensResponse(raw);

  onProgress?.(`writing globals.css (${globalsCss.length} chars)...`);
  await writeSiteFile("app/globals.css", globalsCss);

  return ["app/globals.css"];
}
