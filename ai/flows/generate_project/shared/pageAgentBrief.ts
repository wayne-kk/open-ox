/**
 * Page Agent opening user message — task context only.
 * Workspace files are pre-loaded in a separate bootstrap message (see pageAgentBootstrap.ts).
 */

import type { PlannedPageBlueprint } from "../types";

export const PAGE_AGENT_DESIGN_SYSTEM_PATH = "design-system.md";
export const PAGE_AGENT_LAYOUT_PATH = "app/layout.tsx";
export const PAGE_AGENT_GLOBALS_PATH = "app/globals.css";
/** @deprecated Hero skill path removed from Page Agent pipeline. */
export const PAGE_AGENT_HERO_SKILL_PATH = "content/hero-skill.md";

export interface BuildPageAgentUserMessageParams {
  targetPath: string;
  slug: string;
  pageTitle: string;
  pageDescription: string;
  journeyStage: string;
  planJson: string;
  projectTitle: string;
  projectDescription: string;
  language: string;
  designKeywords: string[];
  userProvidedFileHint: string;
  userProvidedImagesBlock: string;
  userImageCount: number;
  completeToolName: string;
  /** Screenshot replicate: page owns header/footer; layout is pass-through only. */
  screenshotReplicaLayout?: boolean;
}

/** Canonical page-level plan consumed by the Page Implement Role Worker. */
export function buildPageImplementPlanJson(
  page: Pick<PlannedPageBlueprint, "pageDesignPlan" | "sections">
): string {
  return JSON.stringify(
    {
      pageGoal: page.pageDesignPlan.pageGoal,
      narrativeArc: page.pageDesignPlan.narrativeArc,
      layoutStrategy: page.pageDesignPlan.layoutStrategy,
      hierarchy: page.pageDesignPlan.hierarchy,
      constraints: page.pageDesignPlan.constraints,
      sections: page.sections,
    },
    null,
    2
  );
}

function buildWorkspaceNoteBlock(params: BuildPageAgentUserMessageParams): string {
  const lines = [
    "The **next message** pre-loads full `design-system.md`, layout, globals, directory trees",
    ...(params.userProvidedFileHint ? ["and user-provided content"] : []),
    "— **do not re-read** those paths; start writing.",
  ];
  return lines.join(" ");
}

export function buildPageAgentUserMessage(params: BuildPageAgentUserMessageParams): string {
  const {
    targetPath,
    slug,
    pageTitle,
    pageDescription,
    journeyStage,
    planJson,
    projectTitle,
    projectDescription,
    language,
    designKeywords,
    userProvidedFileHint,
    userProvidedImagesBlock,
    userImageCount,
    completeToolName,
    screenshotReplicaLayout,
  } = params;

  const layoutContractBlock = screenshotReplicaLayout
    ? `## Layout contract (screenshot replicate)
\`${PAGE_AGENT_LAYOUT_PATH}\` is **pass-through only** (\`{children}\` — no global Nav/Footer).
**Do not** create \`components/chrome/**\`. Reproduce header/nav/footer from the reference **inside** \`${targetPath}\` or \`components/**\` section files.
`
    : `## Layout contract (chrome-first — shell already mounted)
\`${PAGE_AGENT_LAYOUT_PATH}\` already mounts global chrome from Chrome Scaffold (\`components/chrome/**\`: Nav / Sidebar / Footer / tabs).
**Do not** create \`components/chrome/**\`, and **do not** implement site-wide Nav/Navbar/Header/Sidebar/Footer, **bottom tab bars**, or **app shell** frames in \`${targetPath}\` or page section components — the shell is always owned by Chrome.
Fill page **sections** / main content only (e.g. feed viewport, hero). Single-page sites: stable section \`id\` attributes (e.g. \`id="features"\`).
Reuse \`components/shared/**\` stubs when present for list/detail cards.
`;

  const keywordsLine =
    designKeywords.length > 0
      ? designKeywords.join(", ")
      : "(none — follow Visual Contract + brief; do not invent clean/modern/professional)";

  return `## Implement this Next.js route (App Router)

**Target page file**: \`${targetPath}\`
**Slug**: ${slug}
**Page title**: ${pageTitle}

## Page description
${pageDescription}

## Journey stage
${journeyStage}

## Page design plan and section manifest (canonical)
${planJson}

When \`sections\` is non-empty, you must implement every listed section exactly once and in array order. Do not add, remove, merge, or reorder listed sections. Preserve each section's intent and contentHints while freely choosing the visual execution and final copy.

## Workspace context
${buildWorkspaceNoteBlock(params)}

${layoutContractBlock}
## Project
- Title: ${projectTitle}
- Description: ${projectDescription}
- Language: ${language}
- Design keywords: ${keywordsLine}
${userProvidedFileHint}${userProvidedImagesBlock}

## Instructions
1. **Implement first**: After the bootstrap message, \`write_file\` / \`edit_file\` for \`${targetPath}\` and page-local \`components/**\`. Prefer **one turn with parallel \`write_file\`** for the page and its components.
2. **User images**: Use listed https URLs as remote \`src\`; each URL at most once.${
    userImageCount > 0
      ? ` ${userImageCount} user URL(s) — assign all before \`generate_image\` for extras.`
      : " Use \`generate_image\` only when you need visuals without user URLs."
  }
3. **Fix & finish**: \`read_lints\` if needed (then \`read_file\` only for paths **not** in bootstrap); \`${completeToolName}\` with a brief summary. Do not call \`format_code\` — write/edit auto-formats.

⚠️ \`${completeToolName}\` is mandatory.

Do not invent extra top-level routes beyond this page.`;
}

/** @deprecated Use {@link buildPageAgentUserMessage} */
export const buildCompactPageAgentUserMessage = buildPageAgentUserMessage;
