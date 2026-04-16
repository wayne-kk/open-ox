import { existsSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
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

interface SkillYamlEntry {
  name: string;
  keywords: string[];
  users_type: string[];
  emotional: string;
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

/**
 * Parse skills.yaml and return the skill metadata entries.
 * The file uses gray-matter frontmatter wrapping the YAML content body.
 */
function loadSkillsYaml(): SkillYamlEntry[] {
  const filePath = join(getDesignSystemSkillDir(), SKILLS_YAML_FILENAME);
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = matter(raw);

  // The actual skills data is in the markdown body as YAML.
  let bodyData: { skills?: SkillYamlEntry[] };
  try {
    const yaml = require("js-yaml");
    bodyData = yaml.load(parsed.content) as { skills?: SkillYamlEntry[] };
  } catch {
    bodyData = parsed.data as { skills?: SkillYamlEntry[] };
  }

  if (!Array.isArray(bodyData?.skills)) {
    return [];
  }

  return bodyData.skills;
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
  const parsed = matter(raw);
  const content = parsed.content;

  // Extract content between <design-system> and </design-system> tags
  const openTag = "<design-system>";
  const closeTag = "</design-system>";
  const startIdx = content.indexOf(openTag);
  const endIdx = content.indexOf(closeTag);

  if (startIdx === -1) {
    // No explicit tags — use the full markdown content (after frontmatter)
    return content.trim() || null;
  }

  const inner = content.slice(
    startIdx + openTag.length,
    endIdx === -1 ? undefined : endIdx
  );
  return inner.trim() || null;
}

/**
 * Build the skills metadata block for the LLM prompt.
 */
function buildSkillsMetadataBlock(skills: SkillYamlEntry[]): string {
  return skills
    .map(
      (skill) =>
        `### ${skill.name}
- **关键词**: ${skill.keywords.join(", ")}
- **典型用户/场景**: ${skill.users_type.join(", ")}
- **情绪基调**: ${skill.emotional}`
    )
    .join("\n\n");
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepMatchDesignSystemSkill(params: {
  designIntentText: string;
  designKeywords: string[];
  productType: string;
  projectDescription: string;
  styleGuide?: string;
}): Promise<DesignSystemMatchResult> {
  const { designIntentText, designKeywords, productType, projectDescription, styleGuide } = params;

  const emptyTrace: StepTrace = {};

  // 1. Load skill metadata from skills.yaml
  const skills = loadSkillsYaml();
  if (skills.length === 0) {
    return { matched: false, skillId: null, reason: "No design-system skills found in skills.yaml", trace: emptyTrace };
  }

  // 2. Build prompts
  const skillsMetadata = buildSkillsMetadataBlock(skills);
  const systemPromptTemplate = loadStepPrompt("matchDesignSystemSkill");
  const systemPrompt = composePromptBlocks([
    systemPromptTemplate.replace("{{skills_metadata}}", skillsMetadata),
    loadGuardrail("outputJson"),
  ]);

  const userMessageParts = [
    `## 项目信息`,
    `- 项目描述: ${projectDescription}`,
    `- 产品类型: ${productType}`,
    `- 设计关键词: ${designKeywords.join(", ")}`,
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
        designKeywords,
        productType,
        projectDescription,
        hasStyleGuide: !!styleGuide,
        availableSkills: skills.map((s) => s.name),
      },
    };

    response = JSON.parse(extractJSON(llmResult.content)) as MatchLLMResponse;
  } catch (err) {
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
  const knownNames = new Set(skills.map((s) => s.name));
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
