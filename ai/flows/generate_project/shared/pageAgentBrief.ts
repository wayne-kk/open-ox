/**
 * Page Agent opening user message — task context only.
 * Workspace files are pre-loaded in a separate bootstrap message (see pageAgentBootstrap.ts).
 */

export const PAGE_AGENT_DESIGN_SYSTEM_PATH = "design-system.md";
export const PAGE_AGENT_LAYOUT_PATH = "app/layout.tsx";
export const PAGE_AGENT_GLOBALS_PATH = "app/globals.css";
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
  /** When set, hero skill body was written to {@link PAGE_AGENT_HERO_SKILL_PATH}. */
  heroSkillId?: string | null;
  heroSkillOnDisk?: boolean;
  userProvidedFileHint: string;
  userProvidedImagesBlock: string;
  userImageCount: number;
  completeToolName: string;
}

function buildWorkspaceNoteBlock(params: BuildPageAgentUserMessageParams): string {
  const lines = [
    "The **next message** pre-loads design-system, layout, globals, directory trees",
    ...(params.heroSkillOnDisk && params.heroSkillId
      ? [`and hero skill \`${params.heroSkillId}\``]
      : []),
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
  } = params;

  return `## Implement this Next.js route (App Router)

**Target page file**: \`${targetPath}\`
**Slug**: ${slug}
**Page title**: ${pageTitle}

## Page description
${pageDescription}

## Journey stage
${journeyStage}

## Page design plan (canonical)
${planJson}

## Workspace context
${buildWorkspaceNoteBlock(params)}

## Layout contract (read-only paths)
\`${PAGE_AGENT_LAYOUT_PATH}\` and \`components/chrome/**\` are scaffolded before this step — **do not edit**.
Fill only the \`{children}\` region. Single-page sites: stable section \`id\` attributes (e.g. \`id="features"\`).

## Project
- Title: ${projectTitle}
- Description: ${projectDescription}
- Language: ${language}
- Design keywords: ${designKeywords.join(", ")}
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
