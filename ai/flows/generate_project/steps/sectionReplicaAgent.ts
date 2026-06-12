import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { getModelForStep } from "@/lib/config/models";
import { buildSectionFilePath } from "../shared/paths";
import { pageSpecSectionToJson, type PageSpecSection } from "../schema/pageSpec";
import { resolvePageImplementAgentRuleIds } from "../shared/agentRuleBundles";
import type { PlannedSectionSpec, StepTrace } from "../types";
import {
  PAGE_AGENT_DESIGN_SYSTEM_PATH,
  PAGE_AGENT_GLOBALS_PATH,
  PAGE_AGENT_LAYOUT_PATH,
} from "../shared/pageAgentBrief";
import {
  buildPageAgentBootstrap,
  isPageAgentBootstrapEnabled,
} from "../shared/pageAgentBootstrap";
import {
  createBootstrapGuardedListDirExecutor,
  createBootstrapGuardedReadExecutor,
  executePageAgentListDir,
  executePageAgentReadFile,
} from "../shared/pageAgentToolLoop";

export const SECTION_REPLICA_COMPLETE = "section_replica_complete";

const TOOL_NAMES = ["read_file", "write_file", "edit_file", "list_dir", "read_lints", "think"] as const;

const completeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: SECTION_REPLICA_COMPLETE,
    description:
      "MANDATORY final action after the section component file is written. " +
      "Precondition: output path exists with a default export.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "1-2 sentences on layout approach." },
      },
      required: ["summary"],
    },
  },
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

function sectionPhaseSlug(pageSlug: string, fileName: string): string {
  const safePage = pageSlug.replace(/[^a-zA-Z0-9]+/g, "_");
  const safeFile = fileName.replace(/[^a-zA-Z0-9]+/g, "_");
  return `section_replica__${safePage}__${safeFile}`;
}

function assertDefaultExport(tsx: string, path: string): void {
  if (!/export\s+default\s+function\b/.test(tsx) && !/export\s+default\s+\w+/.test(tsx)) {
    throw new Error(`section_replica_agent: ${path} must include a default export`);
  }
}

export interface RunSectionReplicaAgentParams {
  pageSlug: string;
  section: PlannedSectionSpec;
  pageSpecSection: PageSpecSection;
  designSystem: string;
  language: string;
}

export interface SectionReplicaAgentResult {
  outputPath: string;
  summary: string;
  trace: StepTrace;
  toolCallRecords: number;
}

export async function runSectionReplicaAgent(
  params: RunSectionReplicaAgentParams
): Promise<SectionReplicaAgentResult> {
  const { pageSlug, section, pageSpecSection, language } = params;
  const outputPath = buildSectionFilePath(pageSlug, section.fileName);
  const model = getModelForStep("section_replica_agent");
  const agentStepName = `section_replica_agent:${pageSlug}:${section.fileName}`;
  const phaseSlug = sectionPhaseSlug(pageSlug, section.fileName);

  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("sectionReplicaAgent"),
    loadGuardrail("screenshotLayoutFidelity"),
    loadGuardrail("screenshotReplicateNoUserAssets"),
    loadGuardrail("screenshotReplicatePageOwnsChrome"),
    loadGuardrail("tailwindMappingGuide"),
    loadGuardrail("section.default"),
    loadGuardrail("outputTsx"),
    ...resolvePageImplementAgentRuleIds({ userProvidedImageCount: 0 }).map(loadGuardrail),
  ]);

  const bootstrapEnabled = isPageAgentBootstrapEnabled();
  let bootstrappedPaths = new Set<string>();
  let bootstrapSummary = "";
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (bootstrapEnabled) {
    const bootstrap = buildPageAgentBootstrap({
      heroSkillOnDisk: false,
      hasUserProvidedContent: false,
    });
    bootstrappedPaths = bootstrap.bootstrappedPaths;
    bootstrapSummary = bootstrap.compactSummary;
    messages.push({ role: "user", content: bootstrap.message });
  }

  const userMessage = `## Section replica task

**Output path**: \`${outputPath}\`
**Page slug**: ${pageSlug}
**Section fileName**: ${section.fileName}
**Language**: ${language}

## PageSpec section (canonical — do not invent beyond this)
${pageSpecSectionToJson(pageSpecSection)}

## Read-only paths
- \`${PAGE_AGENT_DESIGN_SYSTEM_PATH}\`
- \`${PAGE_AGENT_LAYOUT_PATH}\`
- \`${PAGE_AGENT_GLOBALS_PATH}\`
- \`components/chrome/**\` — do not edit

Implement this single section, then call \`${SECTION_REPLICA_COMPLETE}\`.`;

  messages.push({ role: "user", content: userMessage });

  const readFileExecutor = bootstrapEnabled
    ? createBootstrapGuardedReadExecutor(bootstrappedPaths)
    : executePageAgentReadFile;
  const listDirExecutor = bootstrapEnabled
    ? createBootstrapGuardedListDirExecutor(bootstrappedPaths)
    : executePageAgentListDir;

  const tools: ChatCompletionTool[] = [
    ...getSystemToolDefinitions([...TOOL_NAMES]),
    completeTool,
  ];

  let complete = false;
  let completeSummary = "";

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools,
    temperature: 0.35,
    maxIterations: 12,
    model,
    executeToolOverrides: {
      read_file: readFileExecutor,
      list_dir: listDirExecutor,
      [SECTION_REPLICA_COMPLETE]: async (args: Record<string, unknown>): Promise<ToolResult> => {
        complete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        return { success: true, output: "section_replica_complete acknowledged" };
      },
    },
    shouldAbortAfterToolResults: () => complete,
    requireTools: true,
    langfusePhase: phaseSlug,
  });

  if (!complete) {
    const tsx = readSiteFile(outputPath);
    const ok =
      tsx.length > 0 &&
      (/export\s+default\s+function\b/.test(tsx) || /export\s+default\s+\w+/.test(tsx));
    if (ok) {
      complete = true;
      completeSummary = content || `[implicit] Section at ${outputPath}`;
    } else {
      throw new Error(
        `${agentStepName}: failed to write ${outputPath} (toolCalls=${toolCalls.length})`
      );
    }
  }

  const tsx = readSiteFile(outputPath);
  assertDefaultExport(tsx, outputPath);
  await formatSiteFile(outputPath);

  const trace: StepTrace = {
    input: { pageSlug, fileName: section.fileName, outputPath, bootstrapSummary },
    output: { completeSummary, toolInvocations: toolCalls.length },
    llmCall: {
      model,
      systemPrompt: truncate(systemPrompt, 3000),
      userMessage: truncate(userMessage, 3000),
      rawResponse: truncate(content, 4000),
    },
  };

  return {
    outputPath,
    summary: completeSummary || "ok",
    trace,
    toolCallRecords: toolCalls.length,
  };
}
