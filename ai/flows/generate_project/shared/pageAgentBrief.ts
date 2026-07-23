import { slugToPageComponentRoot } from "./paths";

/**
 * Page Agent opening user message — task context only.
 * Workspace files are pre-loaded in a separate bootstrap message (see pageAgentBootstrap.ts).
 */

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
  const componentRoot = slugToPageComponentRoot(slug);

  const layoutContractBlock = screenshotReplicaLayout
    ? `## Layout contract (screenshot replicate)
\`${PAGE_AGENT_LAYOUT_PATH}\` is **pass-through only** (\`{children}\` — no global Nav/Footer).
**Do not** create \`components/chrome/**\`. Reproduce header/nav/footer from the reference **inside** \`${targetPath}\` or \`${componentRoot}/**\`.
`
    : `## Layout contract (chrome-first — shell already mounted)
\`${PAGE_AGENT_LAYOUT_PATH}\` already mounts global chrome from Chrome Scaffold (\`components/chrome/**\`: Nav / Sidebar / Footer / tabs).
**Do not** create \`components/chrome/**\`, and **do not** implement site-wide Nav/Navbar/Header/Sidebar/Footer, **bottom tab bars**, or **app shell** frames in \`${targetPath}\` or page section components — the shell is always owned by Chrome.
Fill page **sections** / main content only (e.g. feed viewport, hero). Put extracted components only under \`${componentRoot}/**\`. Single-page sites: stable section \`id\` attributes (e.g. \`id="features"\`).
Reuse \`components/shared/**\` stubs when present for list/detail cards.
`;

  const keywordsLine =
    designKeywords.length > 0
      ? designKeywords.join(", ")
      : "(none — follow Visual Contract + brief; do not invent clean/modern/professional)";

  return `## Implement this Next.js route (App Router)

**Target page file**: \`${targetPath}\`
**Page component root**: \`${componentRoot}/**\`
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

${layoutContractBlock}
## Project
- Title: ${projectTitle}
- Description: ${projectDescription}
- Language: ${language}
- Design keywords: ${keywordsLine}
${userProvidedFileHint}${userProvidedImagesBlock}

## Instructions
1. **Implement this route only**: Other routes are handled by separate Page Agents. The tool runtime permits exactly one \`write_file\` or \`edit_file\` call per response.
2. **Write each file once**: Write page-local components under \`${componentRoot}/**\` first. After each successful write, continue to the next required file instead of rewriting that path. Write \`${targetPath}\` last and only once, after its imports are known.
3. **User images**: Use listed https URLs as remote \`src\`; each URL at most once.${
    userImageCount > 0
      ? ` ${userImageCount} user URL(s) — assign all before \`generate_image\` for extras.`
      : " Use \`generate_image\` only when you need visuals without user URLs."
  }
4. **Fix & finish**: Run \`read_lints\` after the files are written. When a diagnostic names a written file, use \`edit_file\` only for the smallest required fix; do not replace the whole file with \`write_file\`. Then call \`${completeToolName}\` with a brief summary. Do not call \`format_code\` — write/edit auto-formats.

⚠️ \`${completeToolName}\` is mandatory.

Do not write another route or any component outside \`${componentRoot}/**\`.`;
}

/** @deprecated Use {@link buildPageAgentUserMessage} */
export const buildCompactPageAgentUserMessage = buildPageAgentUserMessage;
