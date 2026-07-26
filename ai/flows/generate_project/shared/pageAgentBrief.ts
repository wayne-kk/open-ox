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

function buildWorkspaceNoteBlock(
  params: BuildPageAgentUserMessageParams,
): string {
  const lines = [
    "The **next message** pre-loads full `design-system.md`, layout, globals, directory trees",
    ...(params.userProvidedFileHint ? ["and user-provided content"] : []),
    "— **do not re-read** those paths; start writing.",
  ];
  return lines.join(" ");
}

export function buildPageAgentUserMessage(
  params: BuildPageAgentUserMessageParams,
): string {
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
1. **Implement this route only; create the target first**: Other routes are handled by separate Page Workers. Your first available action is \`create_target_page\`; the runtime binds it to \`${targetPath}\`, so submit only the complete TSX source.
2. **Build after the target exists**: The runtime then exposes \`create_page_component\` for new files under \`${componentRoot}/**\`. Create each path once. To revise an owned file, call \`read_page_file\`, then \`edit_page_file\` with the returned exact revision plus exact old/new text.
3. **User images**: Use listed https URLs as remote \`src\`; each URL at most once.${
    userImageCount > 0
      ? ` ${userImageCount} user URL(s) — assign all before \`generate_image\` for extras.`
      : " Use \`generate_image\` only when you need visuals without user URLs."
  }
4. **Images, fixes & finish**: Declare final stable local paths such as \`/images/home-hero.png\` directly in source, then call \`generate_image\`; the runtime writes the asset to that declared path, so do not edit the source afterward. Only a forbidden remote/placeholder reference requires \`read_page_file\` + \`edit_page_file\`. Call \`verify_page_files\`; diagnostics are repaired with the same read/edit sequence. Completion is automatic. Formatting is automatic.

Do not repeat a successful create command or recreate a path to revise it. Finish by calling \`page_implementation_complete\` with a concise summary. Image tools are unavailable until the target page exists.

Do not write another route or any component outside \`${componentRoot}/**\`.`;
}

/** @deprecated Use {@link buildPageAgentUserMessage} */
export const buildCompactPageAgentUserMessage = buildPageAgentUserMessage;
