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
1. **Declare the page component graph first**: Your first action is \`declare_page_components\`. Declare 1-15 meaningful components under \`${componentRoot}/**\`, each with one responsibility and a \`usedBy\` parent (another declared component or \`${targetPath}\`). List dependencies before their parents. Include a concise \`compositionIntent\` explaining how the components form one coherent experience. Model regions, interactions, data displays, and local controls as needed; do not reduce the graph to a stack of generic Sections.
2. **Complete components before the page**: Create every declared component before \`${targetPath}\` using \`create_page_component\`, strictly following dependency-first order. Each component must default export its React component. Parents must import declared children through the stable \`@/<component path without .tsx>\` module path and render them. Create each path once. To revise an owned file, call \`read_page_file\`, then \`edit_page_file\` with the returned exact revision plus exact old/new text.
3. **User images**: Use listed https URLs as remote \`src\`; each URL at most once.${
    userImageCount > 0
      ? ` ${userImageCount} user URL(s) — assign all before \`generate_image\` for extras.`
      : " Use \`generate_image\` only when you need visuals without user URLs."
  }
4. **Assemble, verify, finish**: After every declared component is complete, create the final \`${targetPath}\` as a thin assembly of the graph's root components. Every declared component must be imported and rendered by its declared \`usedBy\` parent. Declare stable image paths such as \`/images/home-hero.png\` in component source, then call \`generate_image\`; the runtime writes the asset at that path. Call \`verify_page_files\` after the final page write, repair diagnostics, then call \`page_implementation_complete\`. Formatting is automatic.

Maintain one visual and narrative composition across component boundaries: carry the design system, content hierarchy, state ownership, pacing, and transitions through the graph. Do not repeat a successful create command or recreate a path to revise it.

Do not write another route or any component outside \`${componentRoot}/**\`.`;
}

/** @deprecated Use {@link buildPageAgentUserMessage} */
export const buildCompactPageAgentUserMessage = buildPageAgentUserMessage;
