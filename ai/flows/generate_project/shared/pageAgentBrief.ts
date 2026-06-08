/**
 * Page Agent opening user message — task context + on-disk file pointers.
 * Large artifacts (design-system, layout, globals, hero skill) are not inlined;
 * the agent read_file's them when needed.
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

function buildOnDiskReferencesBlock(params: BuildPageAgentUserMessageParams): string {
  const lines = [
    `- \`${PAGE_AGENT_DESIGN_SYSTEM_PATH}\` — design system / visual rules`,
    `- \`${PAGE_AGENT_LAYOUT_PATH}\` — chrome layout contract (**read-only** for you)`,
    `- \`${PAGE_AGENT_GLOBALS_PATH}\` — CSS tokens (**read-only** — do not write/edit)`,
  ];
  if (params.heroSkillOnDisk && params.heroSkillId) {
    lines.push(
      `- \`${PAGE_AGENT_HERO_SKILL_PATH}\` — hero section recipe (skill \`${params.heroSkillId}\`)`
    );
  }
  if (params.userProvidedFileHint) {
    lines.push(`- \`content/user-provided.md\` — organized user content (read when needed)`);
  }
  lines.push(`- Use \`list_dir\` on \`app/\` and \`components/\` to see existing files before writing.`);
  return lines.join("\n");
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

## On-disk references (\`read_file\` when you need them)
${buildOnDiskReferencesBlock(params)}

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
1. **Explore**: \`read_file\` / \`list_dir\` the references above as needed (parallel calls OK). Read \`${PAGE_AGENT_DESIGN_SYSTEM_PATH}\`, \`${PAGE_AGENT_LAYOUT_PATH}\`, and \`${PAGE_AGENT_GLOBALS_PATH}\` before your first \`write_file\`.
2. **Implement**: \`write_file\` / \`edit_file\` for \`${targetPath}\` and page-local \`components/**\`. Prefer **one turn with parallel \`write_file\`** for the page and its components once context is loaded.
3. **User images**: Use listed https URLs as remote \`src\`; each URL at most once.${
    userImageCount > 0
      ? ` ${userImageCount} user URL(s) — assign all before \`generate_image\` for extras.`
      : " Use \`generate_image\` only when you need visuals without user URLs."
  }
4. **Fix & finish**: \`edit_file\` / \`read_lints\` if needed; then \`${completeToolName}\` with a brief summary. Do not call \`format_code\` — write/edit auto-formats.

⚠️ \`${completeToolName}\` is mandatory.

Do not invent extra top-level routes beyond this page.`;
}

/** @deprecated Use {@link buildPageAgentUserMessage} */
export const buildCompactPageAgentUserMessage = buildPageAgentUserMessage;
