import { existsSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { composePromptBlocks, loadStepPrompt, writeSiteFile, loadGuardrail } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import type { StepTrace } from "../types";

// ── Types ────────────────────────────────────────────────────────────────

export interface DesignSystemMatchResult {
  matched: boolean;
  skillId: string | null;
  /**
   * Full markdown body of the matched skill (frontmatter stripped). Includes any
   * `<implementation-rules>` and `<design-system>` blocks, which are passed
   * verbatim to downstream agents — no per-block extraction is performed here.
   */
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

export function getDesignSystemSkillDir(): string {
  const root = process.cwd();
  return join(root, "ai", "flows", "generate_project", "prompts", "skills", DESIGN_SYSTEM_SKILL_DIR);
}

/**
 * Strip optional YAML frontmatter (`---\n...\n---`) at the top of a markdown
 * file. Frontmatter is metadata for tooling (title/created/modified) and has
 * no value for the LLM — everything else is preserved verbatim.
 */
function stripFrontmatter(raw: string): string {
  if (!raw.trimStart().startsWith("---")) {
    return raw.trim();
  }
  try {
    return matter(raw).content.trim();
  } catch {
    // Malformed frontmatter — fall back to a permissive stripper so we never
    // break the pipeline over a metadata typo.
    const normalized = raw.replace(/\r\n/g, "\n");
    const closingIndex = normalized.indexOf("\n---\n", 4);
    if (closingIndex !== -1) {
      return normalized.slice(closingIndex + 5).trim();
    }
    return normalized.replace(/^---/, "").trim();
  }
}

function loadSkillsYamlRaw(): string {
  const filePath = join(getDesignSystemSkillDir(), SKILLS_YAML_FILENAME);
  if (!existsSync(filePath)) {
    return "";
  }
  const raw = readFileSync(filePath, "utf-8");
  return stripFrontmatter(raw);
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
 * Load a design-system skill `.md` file and return its full body (frontmatter
 * stripped). The entire markdown — including any `<implementation-rules>`,
 * `<design-system>`, prose, examples — is returned as a single string so the
 * downstream agent prompt always sees the complete skill spec.
 */
export function loadSkillContent(skillId: string): string | null {
  const filePath = join(getDesignSystemSkillDir(), `${skillId}.md`);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, "utf-8");
  const content = stripFrontmatter(raw);
  return content.length > 0 ? content : null;
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepMatchDesignSystemSkill(params: {
  userInput: string;
}): Promise<DesignSystemMatchResult> {
  const { userInput } = params;

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
    `## 用户原始需求（唯一依据）`,
    userInput,
  ];

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
      getModelForStep("match_design_system_skill"),
      { langfuseName: lfPlain(LfPlain.matchDesignSystemSkill) }
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

  // 5. Load the full skill .md content (frontmatter stripped). No per-block
  //    extraction — the entire spec (implementation-rules + design-system +
  //    any prose/examples) is passed through to downstream agents as-is.
  const skillContent = loadSkillContent(skillId);
  if (!skillContent) {
    const fallbackReason = `Skill "${skillId}" matched but .md file content is empty, falling back to generation`;
    trace.output = { matched: false, skillId, reason: fallbackReason };
    return { matched: false, skillId, reason: fallbackReason, trace };
  }

  // 6. Persist the verbatim skill content to design-system.md so downstream
  //    agents (and humans inspecting the project) see exactly what was used.
  await writeSiteFile("design-system.md", skillContent);

  trace.output = { matched: true, skillId, reason };

  return {
    matched: true,
    skillId,
    designSystem: skillContent,
    reason,
    trace,
  };
}
