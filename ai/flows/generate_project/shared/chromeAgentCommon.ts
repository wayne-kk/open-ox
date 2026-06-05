import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { listSiteTree, readSiteFile } from "./files";
import type { PlannedProjectBlueprint, StepTrace } from "../types";

export const CHROME_AGENT_TOOL_NAMES = [
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

export const CHROME_AGENT_VISIBLE_TOOL_NAMES = new Set([
  "write_file",
  "edit_file",
  "install_package",
]);

export function truncateChromeAgentText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

export function hasChromeLayoutDefaultExport(tsx: string): boolean {
  return /export\s+default\s+function\b/.test(tsx) || /export\s+default\s+\w+/.test(tsx);
}

export function chromeLayoutRendersChildren(tsx: string): boolean {
  return /\{\s*children\s*\}/.test(tsx);
}

export function buildMinimalChromeRootLayout(blueprint: PlannedProjectBlueprint): string {
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

export function buildBlueprintPagesSummary(blueprint: PlannedProjectBlueprint): string {
  return blueprint.site.pages
    .map((page) => {
      const plan = page.pageDesignPlan;
      return `- **${page.title}** (\`/${page.slug === "home" ? "" : page.slug}\`)
  - goal: ${plan.pageGoal}
  - layoutStrategy: ${plan.layoutStrategy}
  - hierarchy: ${plan.hierarchy.slice(0, 6).join(" → ")}`;
    })
    .join("\n");
}

export function buildChromePreReadContext(): {
  layoutTsx: string;
  globalsCss: string;
  componentsTree: string;
  appTree: string;
} {
  return {
    layoutTsx: readSiteFile("app/layout.tsx") || "(missing — write a fresh root layout)",
    globalsCss: readSiteFile("app/globals.css"),
    componentsTree: listSiteTree("components", { maxDepth: 3, maxEntries: 160 }),
    appTree: listSiteTree("app", { maxDepth: 3, maxEntries: 120 }),
  };
}

export function buildChromeProjectHeader(blueprint: PlannedProjectBlueprint): string {
  return `## Project
- **Title**: ${blueprint.brief.projectTitle}
- **Description**: ${blueprint.brief.projectDescription}
- **Language (bcp47)**: ${blueprint.brief.language || "en"}
- **Product type**: ${blueprint.brief.productScope.productType}
- **MVP**: ${blueprint.brief.productScope.mvpDefinition}
- **Core outcome**: ${blueprint.brief.productScope.coreOutcome}
- **Design keywords**: ${blueprint.experience.designIntent.keywords.join(", ")}`;
}

export function buildChromePreReadBlock(preRead: ReturnType<typeof buildChromePreReadContext>): string {
  return `## Pre-read context (already loaded for you — do NOT re-read these unless you need a file not shown)

### Current \`app/layout.tsx\`
\`\`\`tsx
${preRead.layoutTsx}
\`\`\`

### \`app/globals.css\` (truncated — tokens live here)
\`\`\`css
${truncateChromeAgentText(preRead.globalsCss || "(empty)", 6_000)}
\`\`\`

### Existing \`app/\` tree
\`\`\`
${preRead.appTree}
\`\`\`

### Existing \`components/\` tree
\`\`\`
${preRead.componentsTree}
\`\`\``;
}

export function collectChromeFilesFromToolCalls(
  toolCalls: { name: string; args: Record<string, unknown> }[]
): Set<string> {
  const writtenFiles = new Set<string>(["app/layout.tsx"]);
  for (const call of toolCalls) {
    if (call.name === "write_file" || call.name === "edit_file") {
      const path = typeof call.args.path === "string" ? call.args.path : "";
      if (path && (path.startsWith("app/") || path.startsWith("components/"))) {
        writtenFiles.add(path);
      }
    }
  }
  return writtenFiles;
}

export function buildChromeAgentTrace(params: {
  blueprint: PlannedProjectBlueprint;
  chromeForm: string;
  fellBackToMinimal: boolean;
  writtenFiles: Set<string>;
  completeSummary: string;
  content: string;
  toolCalls: { length: number };
  model: string;
  thinking: string | undefined;
  systemPrompt: string;
  userMessage: string;
}): StepTrace {
  const {
    blueprint,
    chromeForm,
    fellBackToMinimal,
    writtenFiles,
    completeSummary,
    content,
    toolCalls,
    model,
    thinking,
    systemPrompt,
    userMessage,
  } = params;
  return {
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
      assistantTail: truncateChromeAgentText(content, 2000),
      toolInvocations: toolCalls.length,
    },
    llmCall: {
      model,
      thinkingLevel: thinking,
      systemPrompt: truncateChromeAgentText(systemPrompt, 4000),
      userMessage: truncateChromeAgentText(userMessage, 4000),
      rawResponse: truncateChromeAgentText(content, 8000),
    },
  };
}

export function buildChromeCompleteTool(
  toolName: string,
  description: string,
  extraProperties?: Record<string, unknown>
): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: toolName,
      description,
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "Brief summary (2–4 sentences): what you did, files touched, key decisions.",
          },
          chromeForm: {
            type: "string",
            description:
              "Short label for the chrome family (e.g. 'top-nav+footer', 'sidebar+topbar', 'minimal').",
          },
          ...extraProperties,
        },
        required: ["summary", "chromeForm"],
      },
    },
  };
}
