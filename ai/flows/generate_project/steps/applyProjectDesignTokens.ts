import {
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";

export async function stepApplyProjectDesignTokens(
  designSystem: string
): Promise<string[]> {
  const currentGlobalsCss = readSiteFile("app/globals.css");

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("applyProjectDesignTokens"),
    "\n\n",
    loadGuardrail("outputJson"),
  ].join("");

  const userMessage = `## Design System
${designSystem}

## Current globals.css
\`\`\`css
${currentGlobalsCss}
\`\`\`

Generate the updated globals.css using Tailwind CSS v4 syntax.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.3);
  const jsonStr = extractJSON(raw);

  let parsed: { globals_css: string };
  try {
    parsed = JSON.parse(jsonStr) as { globals_css: string };
  } catch {
    throw new Error(`apply_project_design_tokens: failed to parse JSON output.\nRaw:\n${raw}`);
  }

  await writeSiteFile("app/globals.css", parsed.globals_css);
  return ["app/globals.css"];
}
