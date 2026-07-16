/**
 * Page Agent bootstrap — preload workspace context before the Act loop (Cursor-style).
 * Runs synchronously on disk; does not consume LLM iterations.
 *
 * Injects Visual Contract (short) + layout/globals excerpts — not the full design-system.md.
 */

import { USER_PROVIDED_CONTENT_PATH } from "@/lib/content/userProvidedContentText";
import { listSiteTree, readSiteFile } from "./files";
import {
  PAGE_AGENT_DESIGN_SYSTEM_PATH,
  PAGE_AGENT_GLOBALS_PATH,
  PAGE_AGENT_LAYOUT_PATH,
} from "./pageAgentBrief";
import { extractVisualContract } from "./visualContract";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated — full file remains on disk at this path]`;
}

function readBootstrapFile(relativePath: string, maxChars: number): { body: string; loaded: boolean } {
  const raw = readSiteFile(relativePath);
  if (!raw || raw.includes("(missing")) {
    return { body: `(missing on disk: ${relativePath})`, loaded: false };
  }
  return { body: truncate(raw, maxChars), loaded: true };
}

export interface PageAgentBootstrapBundle {
  /** Paths injected in bootstrap — guarded against redundant read_file in the Act loop. */
  bootstrappedPaths: Set<string>;
  /** Full bootstrap user message inserted before the tool loop. */
  message: string;
  /** Short summary re-injected after context compaction. */
  compactSummary: string;
}

export interface BuildPageAgentBootstrapParams {
  hasUserProvidedContent: boolean;
  /** Full design-system markdown (in-memory) used to extract Visual Contract. */
  designSystem?: string;
}

export function isPageAgentBootstrapEnabled(): boolean {
  const v = process.env.PAGE_IMPLEMENT_AGENT_BOOTSTRAP;
  if (v === "0" || v === "false") return false;
  return true;
}

export function buildPageAgentBootstrap(
  params: BuildPageAgentBootstrapParams
): PageAgentBootstrapBundle {
  const bootstrappedPaths = new Set<string>();
  const fileSections: string[] = [];

  const addFileSection = (
    relativePath: string,
    maxChars: number,
    fence: "markdown" | "tsx" | "css"
  ) => {
    bootstrappedPaths.add(relativePath);
    const { body } = readBootstrapFile(relativePath, maxChars);
    fileSections.push(`### \`${relativePath}\`\n\`\`\`${fence}\n${body}\n\`\`\``);
  };

  const dsFromDisk = readSiteFile(PAGE_AGENT_DESIGN_SYSTEM_PATH);
  const designSystemSource =
    params.designSystem?.trim() ||
    (dsFromDisk && !dsFromDisk.includes("(missing") ? dsFromDisk : "") ||
    "";
  const visualContract = extractVisualContract(designSystemSource);

  // Layout + globals only — full design-system.md is on disk for optional read_file.
  addFileSection(PAGE_AGENT_LAYOUT_PATH, 8_000, "tsx");
  addFileSection(PAGE_AGENT_GLOBALS_PATH, 6_000, "css");

  if (params.hasUserProvidedContent) {
    addFileSection(USER_PROVIDED_CONTENT_PATH, 12_000, "markdown");
  }

  const appTree = listSiteTree("app", { maxDepth: 2, maxEntries: 80 });
  const componentsTree = listSiteTree("components", { maxDepth: 3, maxEntries: 120 });

  const message = `## Workspace bootstrap (pre-loaded — do NOT re-read these paths)

The pipeline loaded the references below **before your first tool turn**. They do **not** consume iteration budget.

**Chrome-first:** \`app/layout.tsx\` already mounts global chrome (or is intentional pass-through). Do **not** re-create Nav/Footer/bottom tabs in the page. Start from the first content section / main viewport. Prefer \`components/shared/**\` stubs when present.

**Visual Contract** (below) is the default design brief. Full \`${PAGE_AGENT_DESIGN_SYSTEM_PATH}\` is on disk — \`read_file\` it only if you need a token/detail not covered here.

**Act now:** use \`write_file\` / \`edit_file\` for the target page and page-local \`components/**\`. Only \`read_file\` paths **not** listed below (e.g. after \`read_lints\` points at a specific file).

### Tree: \`app/\`
\`\`\`
${appTree}
\`\`\`

### Tree: \`components/\`
\`\`\`
${componentsTree}
\`\`\`

### Visual Contract (from design system)
\`\`\`markdown
${visualContract}
\`\`\`

${fileSections.join("\n\n")}`;

  const compactSummary = [
    "[Bootstrap still valid — do NOT re-read these paths]",
    `- Visual Contract (injected; full ${PAGE_AGENT_DESIGN_SYSTEM_PATH} via read_file if needed)`,
    `- ${PAGE_AGENT_LAYOUT_PATH} (chrome already mounted — content only)`,
    `- ${PAGE_AGENT_GLOBALS_PATH}`,
    ...(params.hasUserProvidedContent ? [`- ${USER_PROVIDED_CONTENT_PATH}`] : []),
    "Continue with write/edit on the target page, then call page_implementation_complete.",
  ].join("\n");

  return { bootstrappedPaths, message, compactSummary };
}
