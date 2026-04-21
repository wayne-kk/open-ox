import { composePromptBlocks, loadStepPrompt } from "../shared/files";
import { callLLMWithMeta } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { writeSiteFile } from "../shared/files";
import type { StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

export interface DesignIntentResult {
  /** Full markdown text — visual blueprint for downstream design system generation */
  text: string;
  /**
   * English technical keywords extracted from the design intent.
   * Used to improve downstream skill matching (e.g. "lightning", "shader", "particle").
   * Empty array if extraction fails — never blocks the pipeline.
   */
  technicalKeywords: string[];
  /** LLM I/O for Studio step detail (omitted when step is skipped or fails before LLM) */
  trace?: StepTrace;
}

/**
 * Extract English technical keywords from the design intent markdown.
 * Looks for the Keywords line and Bold Signature Choices to infer
 * implementation-relevant terms that help skill matching.
 */
function extractTechnicalKeywords(markdown: string): string[] {
  const keywords: string[] = [];

  // Extract from Keywords line (may be Chinese or English)
  const keywordsMatch = markdown.match(/^-\s*Keywords?:\s*(.+)$/im);
  if (keywordsMatch) {
    const raw = keywordsMatch[1].trim();
    // Split by comma or Chinese comma
    const parts = raw.split(/[,，、]\s*/);
    for (const part of parts) {
      keywords.push(part.trim().toLowerCase());
    }
  }

  // Extract from Bold Signature Choices — these often contain technical terms
  const signatureSection = markdown.match(/Bold Signature Choices[\s\S]*?(?=\n## |\n---|\Z)/i);
  if (signatureSection) {
    const block = signatureSection[0];
    // Look for technical terms in English within the block
    const techTerms = block.match(
      /\b(lightning|shader|webgl|glsl|particle|canvas|three\.?js|framer.motion|gsap|lottie|svg\s*anim|parallax|scroll.?driven|morph|dissolve|generative|kinetic|interactive|glow|neon|aurora|holographic|glassmorphism|neumorphism|3d|mesh\s*gradient)\b/gi
    );
    if (techTerms) {
      for (const term of techTerms) {
        keywords.push(term.toLowerCase().trim());
      }
    }
  }

  // Also scan the full text for high-signal technical terms that map to skills
  const fullTextTechTerms = markdown.match(
    /\b(lightning|shader|webgl|glsl|particle|canvas|three\.?js|framer.motion|gsap|lottie|parallax|generative|kinetic|dissolve|scatter|holographic|glassmorphism|neumorphism|mesh\s*gradient)\b/gi
  );
  if (fullTextTechTerms) {
    for (const term of fullTextTechTerms) {
      keywords.push(term.toLowerCase().trim());
    }
  }

  // Also extract Chinese visual-effect terms and map to English equivalents
  const zhMapping: Record<string, string> = {
    "闪电": "lightning",
    "雷电": "lightning",
    "电光": "lightning",
    "电弧": "lightning",
    "着色器": "shader",
    "粒子": "particle",
    "粒子效果": "particle",
    "画布": "canvas",
    "三维": "3d",
    "全息": "holographic",
    "玻璃拟态": "glassmorphism",
    "霓虹": "neon",
    "极光": "aurora",
    "发光": "glow",
    "视差": "parallax",
    "生成艺术": "generative-art",
    "动态光效": "shader",
  };

  for (const [zh, en] of Object.entries(zhMapping)) {
    if (markdown.includes(zh)) {
      keywords.push(en);
    }
  }

  // Deduplicate
  return [...new Set(keywords)];
}

/**
 * Infer design intent from user input.
 * Returns a markdown text (not JSON) that serves as the visual blueprint
 * for downstream design system generation, plus extracted technical keywords
 * for skill matching.
 * Also saves the output as design-intent.md in the project directory.
 */
export async function stepInferDesignIntent(
  userInput: string
): Promise<DesignIntentResult> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("inferDesignIntent"),
  ]);

  const userMessage = `## User Requirement
${userInput}`;

  const model = getModelForStep("infer_design_intent");

  try {
    const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.4, undefined, model);
    const text = meta.content.trim();
    const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
    if (text) {
      await writeSiteFile("design-intent.md", text);
    }
    const technicalKeywords = extractTechnicalKeywords(text);
    return { text, technicalKeywords, trace };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: "",
      technicalKeywords: [],
      trace: {
        llmCall: {
          model,
          systemPrompt,
          userMessage,
          rawResponse: `[infer_design_intent failed]\n${message}`,
        },
      },
    };
  }
}
