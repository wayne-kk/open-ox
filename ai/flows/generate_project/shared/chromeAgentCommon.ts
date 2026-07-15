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

export type InPageChromeSignal = {
  file: string;
  kind: "top-nav" | "bottom-tab" | "sidebar" | "chrome-filename";
  strength: "strong" | "medium";
  evidence: string;
};

export type ChromeLinkSurvey = {
  routes: { route: string; pageFile: string }[];
  sectionIds: { id: string; file: string }[];
  chromeFiles: { path: string; content: string }[];
  /** Page/section files that already implement site chrome (Nav / bottom tabs / …). */
  inPageChromeSignals: InPageChromeSignal[];
  /**
   * Strong aggregate signal that mounting *another* global Nav is usually wrong.
   * Used as a **planning hint** for the Chrome Agent — not a deterministic pipeline skip.
   */
  shouldSkipGlobalChrome: boolean;
};

/** Filenames that strongly imply page-owned app chrome (not mere section UI). */
const IN_PAGE_CHROME_FILENAME_RE =
  /(^|\/)(nav|navbar|navigation|header|siteheader|appheader|topbar|top-nav|bottomnav|bottom-nav|tabbar|tab-bar|apptabs|mobiletab|sidebar|appshell)(\.|[-_])/i;

/**
 * Detect site-level chrome that Page Agent wrote into page/section files.
 * Used so Chrome Agent can skip mounting a second global Nav (duplicate navigations).
 */
export function detectInPageChromeSignals(
  relativePath: string,
  source: string
): InPageChromeSignal[] {
  const path = relativePath.replace(/\\/g, "/");
  if (!path.endsWith(".tsx") && !path.endsWith(".jsx")) return [];
  if (path.startsWith("components/chrome/") || path.startsWith("components/ui/")) {
    return [];
  }

  const signals: InPageChromeSignal[] = [];
  const base = path.split("/").pop() || path;

  if (IN_PAGE_CHROME_FILENAME_RE.test(base) || IN_PAGE_CHROME_FILENAME_RE.test(path)) {
    signals.push({
      file: path,
      kind: "chrome-filename",
      strength: "strong",
      evidence: `filename suggests site chrome (${base})`,
    });
  }

  const hasNavTag = /<nav\b/i.test(source);
  const stickyTop =
    /\b(?:sticky|fixed)\b[^"'`\n]{0,80}\btop-0\b/i.test(source) ||
    /\btop-0\b[^"'`\n]{0,80}\b(?:sticky|fixed)\b/i.test(source);
  const fixedBottom =
    /\bfixed\b[^"'`\n]{0,100}\bbottom-0\b/i.test(source) ||
    /\bbottom-0\b[^"'`\n]{0,100}\bfixed\b/i.test(source);
  const bottomTabHint =
    /bottom[-_\s]?(?:nav|tab|bar)|tab[-_\s]?bar|mobile[-_\s]?tab/i.test(source) ||
    /首页|探索|消息|我的|Home|Explore|Messages|Profile/u.test(source);
  const linkCount = (source.match(/\bhref\s*=/g) || []).length;
  const sidebarHint =
    /\b(?:sidebar|side-nav|sidenav)\b/i.test(source) ||
    /\bfixed\b[^"'`\n]{0,80}\b(?:left-0|inset-y-0)\b/i.test(source);

  if (fixedBottom && (hasNavTag || bottomTabHint || linkCount >= 3)) {
    signals.push({
      file: path,
      kind: "bottom-tab",
      strength: "strong",
      evidence: "fixed bottom bar with nav/tab affordances",
    });
  } else if (fixedBottom && bottomTabHint) {
    signals.push({
      file: path,
      kind: "bottom-tab",
      strength: "medium",
      evidence: "fixed bottom + tab naming",
    });
  }

  if (hasNavTag && stickyTop && linkCount >= 2) {
    signals.push({
      file: path,
      kind: "top-nav",
      strength: "strong",
      evidence: "<nav> + sticky/fixed top + multiple hrefs",
    });
  } else if (hasNavTag && (stickyTop || linkCount >= 4)) {
    signals.push({
      file: path,
      kind: "top-nav",
      strength: "medium",
      evidence: hasNavTag && stickyTop ? "<nav> + sticky/fixed top" : "<nav> with several hrefs",
    });
  } else if (stickyTop && linkCount >= 4 && /logo|brand|登录|login|search/i.test(source)) {
    signals.push({
      file: path,
      kind: "top-nav",
      strength: "medium",
      evidence: "sticky/fixed top bar with brand/utility chrome",
    });
  }

  if (sidebarHint && linkCount >= 3) {
    signals.push({
      file: path,
      kind: "sidebar",
      strength: stickyTop || /w-(?:56|64|72)\b/.test(source) ? "strong" : "medium",
      evidence: "sidebar-like shell with multiple hrefs",
    });
  }

  return signals;
}

export function resolveShouldSkipGlobalChrome(signals: InPageChromeSignal[]): boolean {
  if (signals.some((s) => s.strength === "strong")) return true;
  const kinds = new Set(signals.map((s) => s.kind));
  // Top + bottom (or sidebar) from page content ⇒ stacking another global Nav is almost always wrong.
  if (kinds.has("top-nav") && (kinds.has("bottom-tab") || kinds.has("sidebar"))) return true;
  return signals.length >= 2;
}

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

  const inPageChromeSignals: InPageChromeSignal[] = [];
  for (const file of sectionScanFiles) {
    const content = readSiteFile(file);
    if (!content) continue;
    inPageChromeSignals.push(...detectInPageChromeSignals(file, content));
  }
  inPageChromeSignals.sort((a, b) => {
    const byFile = a.file.localeCompare(b.file);
    if (byFile !== 0) return byFile;
    return a.kind.localeCompare(b.kind);
  });
  const shouldSkipGlobalChrome = resolveShouldSkipGlobalChrome(inPageChromeSignals);

  return { routes, sectionIds, chromeFiles, inPageChromeSignals, shouldSkipGlobalChrome };
}

export function buildChromeLinkSurveyBlock(survey: ChromeLinkSurvey): string {
  const routesBlock =
    survey.routes.length === 0
      ? "- (no app/**/page.tsx found)"
      : survey.routes.map((r) => `- \`${r.route}\` ← \`${r.pageFile}\``).join("\n");
  const idsBlock =
    survey.sectionIds.length === 0
      ? "- (no section-like ids found — single-page Nav may stay minimal)"
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
  const inPageBlock =
    survey.inPageChromeSignals.length === 0
      ? "- (none — pages look chrome-free; creating global Nav/Footer is usually appropriate)"
      : survey.inPageChromeSignals
          .map(
            (s) =>
              `- **${s.strength}** \`${s.kind}\` in \`${s.file}\` — ${s.evidence}`
          )
          .join("\n");
  const decisionHint = survey.shouldSkipGlobalChrome
    ? `**Planning hint (not a hard ban):** strong in-page chrome signals above suggest choosing \`chromeForm: "page-local"\` or \`"none"\` — keep pass-through layout and do **not** mount a second Navigation (avoids duplicate top bars / stacked bottom tabs). You may still create global chrome if you deliberately consolidate shell ownership; if so, say so in the complete summary.`
    : `**Planning hint:** pages appear chrome-free — prefer creating global Navigation (and Footer if needed) once. Choose one primary shell (\`top-nav\`, \`sidebar\`, \`bottom-tabs\`, …); do not invent both marketing top-nav and app bottom-tabs unless the product clearly needs both.`;

  return `## Disk survey (authoritative — do NOT re-survey with list_dir / search_code / reading page section components)

### Routes
${routesBlock}

### Section anchors (for single-page \`#id\` Nav/Footer links)
${idsBlock}

### In-page chrome signals (evidence for your chromeForm decision)
${inPageBlock}

### Current chrome files (may be empty)
${chromeBlock}

Hard constraint from this survey:
- Prefer these routes / \`#id\` values when writing Nav/Footer.
${decisionHint}
- Do **not** \`read_file\` \`components/home/**\` or other page section components.
- Do **not** modify any \`app/**/page.tsx\` (layout excepted).`;
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
