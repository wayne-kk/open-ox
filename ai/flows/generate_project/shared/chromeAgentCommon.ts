import { existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getSiteRoot } from "@/ai/tools/system/common";
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

/** Form / widget ids that must not become Nav anchors. */
const ANCHOR_ID_NOISE = new Set([
  "root",
  "content",
  "trigger",
  "email",
  "password",
  "name",
  "remember",
  "search",
  "q",
  "query",
  "message",
  "phone",
  "tel",
  "username",
  "confirm-password",
  "confirm_password",
]);

/** Design-mode / sub-copy ids — keep section-level anchors only. */
const SUB_ELEMENT_ID =
  /-(root|headline|subcopy|eyebrow|cta|button|title|desc|description|label|icon|image|img|card|item|grid|list|primary|secondary)$/i;

export type ChromeLinkSurvey = {
  routes: { route: string; pageFile: string }[];
  sectionIds: { id: string; file: string }[];
  chromeFiles: { path: string; content: string }[];
};

/**
 * Map an App Router page file to its URL path.
 * `app/page.tsx` → `/`; `app/(mkt)/pricing/page.tsx` → `/pricing`.
 */
export function pageFileToRoute(pageRelPath: string): string | null {
  const normalized = pageRelPath.replace(/\\/g, "/");
  if (!normalized.startsWith("app/") || !normalized.endsWith("/page.tsx")) {
    if (normalized === "app/page.tsx") return "/";
    return null;
  }
  const inner = normalized.slice("app/".length, -"/page.tsx".length);
  if (!inner) return "/";
  const segments = inner
    .split("/")
    .filter((seg) => seg && !seg.startsWith("(") && !seg.startsWith("@"));
  if (segments.length === 0) return "/";
  return `/${segments.join("/")}`;
}

function isNavWorthyAnchorId(id: string): boolean {
  if (!id || id.length < 2) return false;
  if (ANCHOR_ID_NOISE.has(id.toLowerCase())) return false;
  if (/^(radix|react|aria|btn|input|field)-/i.test(id)) return false;
  if (SUB_ELEMENT_ID.test(id)) return false;
  if (/-(cta|button)-/i.test(id)) return false;
  return true;
}

/**
 * Ids suitable for in-page Nav anchors: landmark/section/div tags with a real
 * `id=` attribute (not `data-*-id`).
 */
export function extractAnchorCandidateIds(source: string): string[] {
  const ids = new Set<string>();
  // (?<![\w-]) avoids matching the "id" suffix inside data-ox-id / aria-labelledby etc.
  const sectionTagRe =
    /<(?:section|main|header|footer|article|div)\b[^>]*?(?<![\w-])id\s*=\s*["']([A-Za-z][\w:-]*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = sectionTagRe.exec(source)) !== null) {
    const id = match[1];
    if (isNavWorthyAnchorId(id)) ids.add(id);
  }
  return Array.from(ids);
}

function walkSiteRelativeFiles(
  relativeDir: string,
  options: { maxDepth?: number; match?: (relPath: string) => boolean } = {}
): string[] {
  const { maxDepth = 6, match } = options;
  const root = getSiteRoot();
  const base = join(root, relativeDir);
  if (!existsSync(base)) return [];

  const out: string[] = [];
  function walk(absDir: string, depth: number): void {
    if (depth > maxDepth) return;
    let names: string[];
    try {
      names = readdirSync(absDir);
    } catch {
      return;
    }
    for (const name of names.sort((a, b) => a.localeCompare(b))) {
      if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
      const abs = join(absDir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === "ui") continue;
        walk(abs, depth + 1);
        continue;
      }
      const rel = relative(root, abs).replace(/\\/g, "/");
      if (match && !match(rel)) continue;
      out.push(rel);
    }
  }
  walk(base, 0);
  return out;
}

/**
 * Deterministic disk survey so chrome optimize can skip exploratory tool rounds.
 * Collects App Router routes, section-like ids, and current chrome file contents.
 */
export function buildChromeLinkSurveyFromDisk(): ChromeLinkSurvey {
  const pageFiles = walkSiteRelativeFiles("app", {
    match: (rel) => rel.endsWith("/page.tsx") || rel === "app/page.tsx",
  });
  const routes = pageFiles
    .map((pageFile) => {
      const route = pageFileToRoute(pageFile);
      return route ? { route, pageFile } : null;
    })
    .filter((x): x is { route: string; pageFile: string } => Boolean(x))
    .sort((a, b) => a.route.localeCompare(b.route));

  const sectionScanFiles = [
    ...pageFiles,
    ...walkSiteRelativeFiles("components", {
      match: (rel) => {
        if (!rel.endsWith(".tsx")) return false;
        if (rel.startsWith("components/chrome/")) return false;
        if (rel.startsWith("components/ui/")) return false;
        return true;
      },
    }),
  ];

  const sectionIds: { id: string; file: string }[] = [];
  const seenIds = new Set<string>();
  for (const file of sectionScanFiles) {
    const content = readSiteFile(file);
    if (!content) continue;
    for (const id of extractAnchorCandidateIds(content)) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      sectionIds.push({ id, file });
    }
  }
  sectionIds.sort((a, b) => a.id.localeCompare(b.id));

  const chromePaths = walkSiteRelativeFiles("components/chrome", {
    match: (rel) => rel.endsWith(".tsx") || rel.endsWith(".ts"),
  });
  const chromeFiles = chromePaths.map((path) => ({
    path,
    content: truncateChromeAgentText(readSiteFile(path) || "(empty)", 4_000),
  }));

  return { routes, sectionIds, chromeFiles };
}

export function buildChromeLinkSurveyBlock(survey: ChromeLinkSurvey): string {
  const routesBlock =
    survey.routes.length === 0
      ? "- (no app/**/page.tsx found)"
      : survey.routes.map((r) => `- \`${r.route}\` ← \`${r.pageFile}\``).join("\n");
  const idsBlock =
    survey.sectionIds.length === 0
      ? "- (no section-like ids found)"
      : survey.sectionIds.map((s) => `- \`#${s.id}\` ← \`${s.file}\``).join("\n");
  const chromeBlock =
    survey.chromeFiles.length === 0
      ? "(no components/chrome/* yet)"
      : survey.chromeFiles
          .map(
            (f) => `### \`${f.path}\`
\`\`\`tsx
${f.content}
\`\`\``
          )
          .join("\n\n");

  return `## Disk survey (authoritative — do NOT re-survey with list_dir / search_code / reading page section components)

### Routes
${routesBlock}

### Section anchors (for single-page \`#id\` Nav/Footer links)
${idsBlock}

### Current chrome files (may be empty)
${chromeBlock}

Hard constraint from this survey:
- Prefer these routes / \`#id\` values when polishing Nav/Footer hrefs.
- Do **not** invent routes or anchors that are absent above.
- Do **not** \`read_file\` \`components/home/**\` or other page section components.
- Do **not** modify any \`app/**/page.tsx\` (layout excepted).
- Do **not** change chrome form / mount a second shell — polish links only.`;
}

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
      <body
        className={inter.className}
        style={{
          fontFamily: \`\${inter.style.fontFamily}, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif\`,
        }}
      >
        {children}
      </body>
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
