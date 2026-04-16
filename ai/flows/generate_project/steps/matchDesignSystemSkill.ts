import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { composePromptBlocks, loadStepPrompt, writeSiteFile, loadGuardrail } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { getModelForStep } from "@/lib/config/models";
import type { StepTrace } from "../types";

// ── Types ────────────────────────────────────────────────────────────────

export interface DesignSystemMatchResult {
  matched: boolean;
  skillId: string | null;
  designSystem?: string;
  reason: string;
  trace: StepTrace;
}

interface MatchLLMResponse {
  skillId: string | null;
  reason: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const SKILLS_YAML_FILENAME = "skills.yaml";
const DESIGN_SYSTEM_SKILL_DIR = "design-system";

function getDesignSystemSkillDir(): string {
  const root = process.cwd();
  return join(root, "ai", "flows", "generate_project", "prompts", "skills", DESIGN_SYSTEM_SKILL_DIR);
}

function stripOptionalFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) {
    return raw;
  }

  const normalized = raw.replace(/\r\n/g, "\n");
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex !== -1) {
    return normalized.slice(closingIndex + 5);
  }

  // Some files accidentally start with a lone --- without valid closing frontmatter.
  return normalized.slice(3).replace(/^\n+/, "");
}

function loadSkillsYamlRaw(): string {
  const filePath = join(getDesignSystemSkillDir(), SKILLS_YAML_FILENAME);
  if (!existsSync(filePath)) {
    return "";
  }

  const raw = readFileSync(filePath, "utf-8");
  return stripOptionalFrontmatter(raw).trim();
}

function extractSkillNamesFromYaml(rawYaml: string): string[] {
  return rawYaml
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- name:"))
    .map((line) => line.slice("- name:".length).trim())
    .filter(Boolean);
}

/**
 * Read a skill .md file and extract the content inside <design-system>...</design-system> tags.
 * Returns the full design-system markdown content, or null if not found.
 */
function loadSkillDesignSystemContent(skillId: string): string | null {
  const filePath = join(getDesignSystemSkillDir(), `${skillId}.md`);
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = readFileSync(filePath, "utf-8");
  const content = stripOptionalFrontmatter(raw);

  // Extract content between <design-system> and </design-system> tags
  const openTag = "<design-system>";
  const closeTag = "</design-system>";
  const startIdx = content.indexOf(openTag);
  const endIdx = content.indexOf(closeTag);

  if (startIdx === -1) {
    const firstHeadingIndex = content.search(/^#\s+/m);
    const fallbackContent =
      firstHeadingIndex >= 0 ? content.slice(firstHeadingIndex).trim() : content.trim();
    return fallbackContent || null;
  }

  const inner = content.slice(
    startIdx + openTag.length,
    endIdx === -1 ? undefined : endIdx
  );
  return inner.trim() || null;
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepMatchDesignSystemSkill(params: {
  userInput: string;
  designIntentText: string;
  designKeywords: string[];
  productType: string;
  projectDescription: string;
  styleGuide?: string;
}): Promise<DesignSystemMatchResult> {
  const {
    userInput,
    designIntentText,
    designKeywords,
    productType,
    projectDescription,
    styleGuide,
  } = params;

  const emptyTrace: StepTrace = {};

  // 1. Load skill metadata from skills.yaml
  const skillsYaml = loadSkillsYamlRaw();
  const skillNames = extractSkillNamesFromYaml(skillsYaml);
  if (!skillsYaml || skillNames.length === 0) {
    return { matched: false, skillId: null, reason: "No design-system skills found in skills.yaml", trace: emptyTrace };
  }

  // 2. Build prompts
  const systemPromptTemplate = loadStepPrompt("matchDesignSystemSkill");
  const systemPrompt = composePromptBlocks([
    systemPromptTemplate.replace("{{skills_metadata}}", `\`\`\`yaml\n${skillsYaml}\n\`\`\``),
    loadGuardrail("outputJson"),
  ]);

  const userMessageParts = [
    `## 项目信息`,
    `- 用户原始需求: ${userInput}`,
    `- 项目描述: ${projectDescription}`,
    `- 产品类型: ${productType}`,
    `- 设计关键词: ${designKeywords.join(", ")}`,
    ``,
    `## 匹配优先级`,
    `1. 优先依据“用户原始需求”判断风格与适配场景`,
    `2. 将“设计意图分析”作为补充参考，而不是唯一依据`,
    `3. 如果用户原始需求与设计意图分析存在偏差，以用户原始需求为准`,
    ``,
    `## 设计意图分析`,
    designIntentText,
  ];

  if (styleGuide) {
    userMessageParts.push(``, `## 用户自定义 Style Guide`, styleGuide);
  }

  const userMessage = userMessageParts.join("\n");

  // 3. Call LLM — lightweight classification, low temperature
  let response: MatchLLMResponse;
  let trace: StepTrace;
  try {
    const llmResult = await callLLMWithMeta(
      systemPrompt,
      userMessage,
      0.2,
      undefined,
      getModelForStep("match_design_system_skill")
    );

    trace = {
      llmCall: {
        model: llmResult.model,
        systemPrompt,
        userMessage,
        rawResponse: llmResult.content,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
      },
      input: {
        userInput,
        designKeywords,
        productType,
        projectDescription,
        hasStyleGuide: !!styleGuide,
        availableSkills: skillNames,
      },
    };

    response = JSON.parse(extractJSON(llmResult.content)) as MatchLLMResponse;
  } catch {
    return {
      matched: false,
      skillId: null,
      reason: "LLM call or JSON parse failed, falling back to generation",
      trace: emptyTrace,
    };
  }

  // 4. Validate the response
  const { skillId, reason } = response;

  if (!skillId) {
    trace.output = { matched: false, skillId: null, reason: reason || "LLM returned no match" };
    return { matched: false, skillId: null, reason: reason || "LLM returned no match", trace };
  }

  // Verify the skillId is one of the known skills
  const knownNames = new Set(skillNames);
  if (!knownNames.has(skillId)) {
    const fallbackReason = `LLM returned unknown skillId "${skillId}", falling back to generation`;
    trace.output = { matched: false, skillId, reason: fallbackReason };
    return { matched: false, skillId: null, reason: fallbackReason, trace };
  }

  // 5. Load the design system content from the skill .md file
  const designSystemContent = loadSkillDesignSystemContent(skillId);
  if (!designSystemContent) {
    const fallbackReason = `Skill "${skillId}" matched but .md file content is empty, falling back to generation`;
    trace.output = { matched: false, skillId, reason: fallbackReason };
    return { matched: false, skillId, reason: fallbackReason, trace };
  }

  // 6. Write to design-system.md
  await writeSiteFile("design-system.md", designSystemContent);

  trace.output = { matched: true, skillId, reason };

  return {
    matched: true,
    skillId,
    designSystem: designSystemContent,
    reason,
    trace,
  };
}
