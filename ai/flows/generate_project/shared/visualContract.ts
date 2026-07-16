/**
 * Extract a short agent-facing Visual Contract from design-system.md.
 * Prefer the machine section `## Visual Contract (agent)`; fall back to a compact
 * synthesis from tokens so bootstrap never injects the full DS (~12k).
 */

const VISUAL_CONTRACT_HEADING = /^##\s*Visual Contract\s*\(agent\)\s*$/im;
const NEXT_H2 = /^##\s+/m;

export const VISUAL_CONTRACT_MAX_CHARS = 2_500;

export function extractVisualContract(designSystem: string): string {
  const source = designSystem?.trim() ?? "";
  if (!source) {
    return fallbackVisualContract("");
  }

  const match = source.match(VISUAL_CONTRACT_HEADING);
  if (match && match.index !== undefined) {
    const start = match.index + match[0].length;
    const rest = source.slice(start);
    const next = rest.search(NEXT_H2);
    const body = (next === -1 ? rest : rest.slice(0, next)).trim();
    if (body.length > 40) {
      return truncateContract(`## Visual Contract (agent)\n\n${body}`);
    }
  }

  return fallbackVisualContract(source);
}

function truncateContract(text: string): string {
  if (text.length <= VISUAL_CONTRACT_MAX_CHARS) return text;
  return `${text.slice(0, VISUAL_CONTRACT_MAX_CHARS)}\n\n[truncated — full design-system.md remains on disk]`;
}

function fallbackVisualContract(designSystem: string): string {
  const colors = extractColorRoles(designSystem);
  const fonts = extractFontRoles(designSystem);
  const bold = extractBoldFactorHints(designSystem);

  const lines = [
    "## Visual Contract (agent)",
    "",
    "_Synthesized from design-system.md (native Visual Contract section missing)._",
    "",
    "### Color roles",
    colors.length ? colors.map((l) => `- ${l}`).join("\n") : "- (read `design-system.md` for tokens)",
    "",
    "### Font roles",
    fonts.length ? fonts.map((l) => `- ${l}`).join("\n") : "- display / header / body via `font-display` `font-header` `font-body`",
    "",
    "### Bold Factor (max 5)",
    bold.length ? bold.map((l, i) => `${i + 1}. ${l}`).join("\n") : "1. Prefer design-system signatures; avoid generic SaaS cream paper.",
    "",
    "### Hero / surfaces",
    "- Hero: follow Design Philosophy + signatures; full-bleed or dominant first viewport.",
    "- Surfaces: use role tokens; no pure `#ffffff` page root.",
  ];
  return truncateContract(lines.join("\n"));
}

function extractColorRoles(ds: string): string[] {
  const roles = [
    "background",
    "foreground",
    "primary",
    "muted",
    "accent",
    "card",
  ] as const;
  const out: string[] = [];
  for (const role of roles) {
    const re = new RegExp(`--color-${role}:\\s*(#[0-9A-Fa-f]{3,8})`, "i");
    const m = ds.match(re);
    if (m) out.push(`\`${role}\`: ${m[1]}`);
  }
  return out;
}

function extractFontRoles(ds: string): string[] {
  const roles = ["display", "header", "body"] as const;
  const out: string[] = [];
  for (const role of roles) {
    const re = new RegExp(`--font-${role}:\\s*([^;\\n]+)`, "i");
    const m = ds.match(re);
    if (m) out.push(`\`${role}\`: ${m[1].trim()}`);
  }
  return out;
}

function extractBoldFactorHints(ds: string): string[] {
  const sigBlock = ds.match(
    /\*\*Visual Signatures[^*]*\*\*:?\s*([\s\S]*?)(?=\n##\s|\n###\s|$)/i
  );
  if (!sigBlock) return [];
  const bullets = [...sigBlock[1].matchAll(/^\s*[-*]\s+\*\*([^*]+)\*\*:?\s*(.+)$/gm)]
    .map((m) => `${m[1].trim()}: ${m[2].trim()}`)
    .slice(0, 5);
  return bullets;
}
