/**
 * Architect Agent — decides global chrome and lands it as real files.
 *
 * Sits between `apply_project_design_tokens` and the parallel page agents.
 * Owns `app/layout.tsx` and `components/chrome/**`. Page agents read these
 * files as the chrome contract and never modify them.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  composePromptBlocks,
  formatSiteFile,
  listSiteTree,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import type { BuildStep, PlannedProjectBlueprint, StepTrace } from "../types";
import { resolveArchitectAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
export const ARCHITECT_AGENT_STEP = "architect_agent";
export const ARCHITECT_COMPLETE = "architect_complete";

const TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "search_code",
  "format_code",
  "read_lints",
  "think",
  "install_package",
  "revert_file",
] as const;

const VISIBLE_TOOL_NAMES = new Set(["write_file", "edit_file", "install_package"]);

const completeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: ARCHITECT_COMPLETE,
    description:
      "MANDATORY — call this tool exactly once as your final action after the " +
      "root layout and any chrome components are in place. Preconditions: " +
      "`app/layout.tsx` exists with a default export rendering `{children}`, " +
      "any chrome components imported by it exist under `components/chrome/**` " +
      "(or wherever you placed them), `format_code` has been applied to every " +
      ".tsx you touched. After you call this, page agents start in parallel and " +
      "read your layout as the chrome contract — do NOT skip this tool.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Brief summary (2–4 sentences): chrome form chosen, files written, key rationale.",
        },
        chromeForm: {
          type: "string",
          description:
            "Short label naming the chrome family you chose (e.g. 'sidebar+topbar', " +
            "'top-nav+footer', 'left-rail+feed+right-rail', 'fullscreen+hud', 'minimal').",
        },
      },
      required: ["summary", "chromeForm"],
    },
  },
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

function hasDefaultExport(tsx: string): boolean {
  return /export\s+default\s+function\b/.test(tsx) || /export\s+default\s+\w+/.test(tsx);
}

function rendersChildren(tsx: string): boolean {
  return /\{\s*children\s*\}/.test(tsx);
}

/**
 * Last-resort minimal layout used when the agent fails to leave a usable
 * `app/layout.tsx` on disk. Page agents will then own all chrome themselves.
 */
function buildMinimalRootLayout(blueprint: PlannedProjectBlueprint): string {
  const lang = blueprint.brief.language?.trim() || "en";
  const title = JSON.stringify(blueprint.brief.projectTitle);
  const description = JSON.stringify(blueprint.brief.projectDescription);
  return `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: ${title},
  description: ${description},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="${lang}">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;
}

export interface RunArchitectAgentParams {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  /** Same reference as generate pipeline — global chrome should match visible shell in screenshot */
  referenceScreenshotDataUrl?: string | null;
  /** When image present: `screenshotLayoutFidelity` vs `screenshotExtractInspiration`. */
  screenshotGuardrailId?: string | null;
  onMessage?: (msg: ChatMessage) => void;
  onStep?: (step: BuildStep) => void;
}

export interface ArchitectAgentResult {
  layoutPath: string;
  files: string[];
  summary: string;
  chromeForm: string;
  fellBackToMinimal: boolean;
  trace: StepTrace;
  toolCallRecords: number;
}

export async function runArchitectAgent(
  params: RunArchitectAgentParams
): Promise<ArchitectAgentResult> {
  const {
    blueprint,
    designSystem,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
    onMessage,
    onStep,
  } = params;
  const model = getModelForStep(ARCHITECT_AGENT_STEP);
  const thinking = getThinkingLevelForStep(ARCHITECT_AGENT_STEP);

  const pagesSummary = blueprint.site.pages
    .map((page) => {
      const plan = page.pageDesignPlan;
      return `- **${page.title}** (\`/${page.slug === "home" ? "" : page.slug}\`)
  - goal: ${plan.pageGoal}
  - layoutStrategy: ${plan.layoutStrategy}
  - hierarchy: ${plan.hierarchy.slice(0, 6).join(" → ")}`;
    })
    .join("\n");

  // Pre-warm context: read template baseline + globals + tree so the agent
  // can skip read_file / list_dir round-trips for the obvious things.
  const layoutTsx = readSiteFile("app/layout.tsx") || "(missing — write a fresh root layout)";
  const globalsCss = readSiteFile("app/globals.css");
  const componentsTree = listSiteTree("components", { maxDepth: 3, maxEntries: 160 });
  const appTree = listSiteTree("app", { maxDepth: 2, maxEntries: 80 });

  const userMessage = `## Decide and scaffold the global chrome for this project

## Project
- **Title**: ${blueprint.brief.projectTitle}
- **Description**: ${blueprint.brief.projectDescription}
- **Language (bcp47)**: ${blueprint.brief.language || "en"}
- **Product type**: ${blueprint.brief.productScope.productType}
- **MVP**: ${blueprint.brief.productScope.mvpDefinition}
- **Core outcome**: ${blueprint.brief.productScope.coreOutcome}
- **Design keywords**: ${blueprint.experience.designIntent.keywords.join(", ")}

## Page plans (downstream Page Agents will fill these)
${pagesSummary}

## Pre-read context (already loaded for you — do NOT re-read these files)

### Current \`app/layout.tsx\` (template baseline — you will overwrite this)
\`\`\`tsx
${layoutTsx}
\`\`\`

### \`app/globals.css\` (truncated — tokens live here)
\`\`\`css
${truncate(globalsCss || "(empty)", 6_000)}
\`\`\`

### Existing \`app/\` tree
\`\`\`
${appTree}
\`\`\`

### Existing \`components/\` tree
\`\`\`
${componentsTree}
\`\`\`

## Design system (reference — \`design-system.md\` need not be re-read)
${truncate(designSystem, 10_000)}

## Workflow (follow strictly)
1. **Decide chrome form** based on product type + page plans (see system prompt for the reference table). The pre-read context above is enough — only \`read_file\` an existing component if you genuinely need its source.
2. **Write files** (auto-formatted on write — no need to call \`format_code\`):
   - Update \`app/layout.tsx\` to the final scaffold (mount chrome + render \`{children}\`).
   - For each chrome piece, write \`components/chrome/<Name>.tsx\` with a real implementation (using design tokens — never invent fake brand content).
   - Use nested \`(group)/layout.tsx\` if route subgroups need different chrome.
3. **Complete**: call \`${ARCHITECT_COMPLETE}\` with a 2–4 sentence summary.

⚠️ Step 3 is mandatory. The pipeline fails if you do not call \`${ARCHITECT_COMPLETE}\`.

Hard rules:
- Do **not** write any \`app/**/page.tsx\` — page content is owned by Page Agents.
- Do **not** invent product features or fake content; chrome may have placeholder navigation labels but must not fabricate marketing claims, customer logos, etc.
- Do **not** add **decorative full-page / full-viewport backgrounds** on \`<body>\`, root layout wrappers, or chrome shells: no hero-style gradients, full-bleed images, mesh or noise textures, or ornamental patterns meant as "scene" backdrop. Keep the canvas **plain** (use existing \`globals.css\` / token background only). Nav/header/footer bars may use normal surface \`bg-*\` for the bar itself — not a site-wide mood layer. **Hero and section atmospherics** belong in **Page Agents** inside \`page.tsx\`.
- Do **not** redefine CSS variables / keyframes already in \`globals.css\`.
- Do **not** call \`format_code\` on files you wrote — \`write_file\`/\`edit_file\` auto-format on save.
- If the product is a fullscreen / minimal canvas form, leaving \`app/layout.tsx\` minimal is the right answer — do not pad chrome to feel productive.`;

  const refGr =
    referenceScreenshotDataUrl?.trim() && screenshotGuardrailId?.trim()
      ? screenshotGuardrailId.trim()
      : referenceScreenshotDataUrl?.trim()
        ? "screenshotLayoutFidelity"
        : null;
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("architectAgent"),
    ...(refGr ? [loadGuardrail(refGr)] : []),
    ...resolveArchitectAgentRuleIds().map(loadGuardrail),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserVisionContent(userMessage, referenceScreenshotDataUrl ?? null),
    },
  ];

  let architectComplete = false;
  let completeSummary = "";
  let chromeForm = "unspecified";

  const maxIterations = Math.max(
    8,
    Math.min(48, Number(process.env.ARCHITECT_AGENT_MAX_ITERATIONS ?? 24))
  );

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [...getSystemToolDefinitions([...TOOL_NAMES]), completeTool],
    temperature: 0.4,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      [ARCHITECT_COMPLETE]: async (
        args: Record<string, unknown>
      ): Promise<ToolResult> => {
        architectComplete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        chromeForm = typeof args.chromeForm === "string" && args.chromeForm.trim()
          ? args.chromeForm.trim()
          : chromeForm;
        return { success: true, output: "architect_complete acknowledged" };
      },
    },
    onMessage,
    shouldAbortAfterToolResults: () => architectComplete,
    onToolCall: ({ name, args, iteration }) => {
      if (!onStep) return;
      if (VISIBLE_TOOL_NAMES.has(name)) {
        const filePath = String(args.path ?? "");
        onStep({
          step: `architect_agent_tool:${name}:${iteration}`,
          status: "ok",
          detail: `${name.replace("_", " ")}: ${filePath}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
      const detail =
        name === "read_file" || name === "list_dir"
          ? `reading ${String(args.path ?? "").split("/").pop() || "..."}`
          : name === "write_file" || name === "edit_file"
            ? `writing ${String(args.path ?? "").split("/").pop() || "..."}`
            : name === "format_code"
              ? `formatting ${String(args.path ?? "").split("/").pop() || "..."}`
              : name === "install_package"
                ? `installing ${String(args.package_name ?? args.packageName ?? "")}`
                : undefined;
      if (detail) {
        onStep({
          step: ARCHITECT_AGENT_STEP,
          status: "active",
          detail: `[iter ${iteration + 1}/${maxIterations}] ${detail}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
    },
    onApproachingLimit: ({ messages: msgs }) => {
      const nudge: ChatMessage = {
        role: "system",
        content:
          `[Iteration Budget] Wrap up now:\n` +
          `1. Ensure \`app/layout.tsx\` exists with a default export rendering \`{children}\`.\n` +
          `2. Ensure every chrome component imported by the layout exists.\n` +
          `3. Call \`${ARCHITECT_COMPLETE}\`.\n` +
          `Files are auto-formatted on write — no need to call format_code. ` +
          `Do NOT start new chrome components — finalize what you have.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: LfToolPhase.architect,
  });

  // Fallback safety net: if the agent failed to leave a usable layout, write a
  // minimal one so page agents can still run. This keeps the pipeline robust
  // when the model misbehaves; the warning surfaces in logs.
  let fellBackToMinimal = false;
  let layoutContent = readSiteFile("app/layout.tsx");

  if (!layoutContent || !hasDefaultExport(layoutContent) || !rendersChildren(layoutContent)) {
    console.warn(
      `[architect_agent] layout invalid after agent run ` +
        `(complete=${architectComplete}, toolCalls=${toolCalls.length}, model=${model}). ` +
        `Falling back to minimal root layout.`
    );
    await writeSiteFile("app/layout.tsx", buildMinimalRootLayout(blueprint));
    await formatSiteFile("app/layout.tsx");
    fellBackToMinimal = true;
    chromeForm = "minimal-fallback";
    if (!completeSummary) {
      completeSummary =
        "Architect agent did not produce a valid layout; pipeline fell back to minimal root layout. Page agents own all chrome.";
    }
    layoutContent = readSiteFile("app/layout.tsx");
  } else {
    await formatSiteFile("app/layout.tsx");
  }

  // Best-effort enumeration of chrome files the agent touched, for trace/artifact.
  const writtenFiles = new Set<string>(["app/layout.tsx"]);
  for (const call of toolCalls) {
    if (call.name === "write_file" || call.name === "edit_file") {
      const path = typeof call.args.path === "string" ? call.args.path : "";
      if (path && (path.startsWith("app/") || path.startsWith("components/"))) {
        writtenFiles.add(path);
      }
    }
  }

  const trace: StepTrace = {
    input: {
      productType: blueprint.brief.productScope.productType,
      pageCount: blueprint.site.pages.length,
      designKeywords: blueprint.experience.designIntent.keywords,
    },
    output: {
      chromeForm,
      fellBackToMinimal,
      filesWritten: Array.from(writtenFiles),
      completeSummary,
      assistantTail: truncate(content, 2000),
      toolInvocations: toolCalls.length,
    },
    llmCall: {
      model,
      thinkingLevel: thinking,
      systemPrompt: truncate(systemPrompt, 4000),
      userMessage: truncate(userMessage, 4000),
      rawResponse: truncate(content, 8000),
    },
  };

  return {
    layoutPath: "app/layout.tsx",
    files: Array.from(writtenFiles),
    summary: completeSummary || content.slice(0, 500) || "ok",
    chromeForm,
    fellBackToMinimal,
    trace,
    toolCallRecords: toolCalls.length,
  };
}
