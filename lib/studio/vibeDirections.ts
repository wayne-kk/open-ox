/**
 * Fallback vibe forks when LLM generation fails.
 * Live Studio picker prefers brief-sensitive directions from
 * {@link generateVibeDirections} (`/api/projects/[id]/vibe-directions`).
 */

export type VibeTokenPreview = {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  accentForeground: string;
  border: string;
  fontDisplay: string;
  fontBody: string;
  radius: string;
};

export type VibeDirection = {
  id: string;
  label: string;
  tagline: string;
  moods: string[];
  tokens: VibeTokenPreview;
  /** Injected as Style Guide into design-system step */
  styleGuide: string;
  /** Used as design-intent.md substitute when user confirms this vibe */
  designIntentMarkdown: string;
  technicalKeywords: string[];
};

export const VIBE_DIRECTIONS: VibeDirection[] = [
  {
    id: "cold-tech",
    label: "冷淡科技",
    tagline: "深色、细线、少装饰",
    moods: ["克制", "精密", "冷静"],
    tokens: {
      background: "#0b0f14",
      foreground: "#e8eef7",
      muted: "#8b9bb0",
      accent: "#5eead4",
      accentForeground: "#042f2e",
      border: "#1e293b",
      fontDisplay: "ui-sans-serif, system-ui, sans-serif",
      fontBody: "ui-sans-serif, system-ui, sans-serif",
      radius: "6px",
    },
    styleGuide: [
      "Direction: cold technical / product engineering aesthetic.",
      "Palette: near-black backgrounds, cool gray text, one teal/cyan accent only.",
      "Typography: tight sans, restrained sizes, high information density without clutter.",
      "Decoration: hairline borders, subtle grids; no purple gradients, no pill badge clusters, no glow stacks.",
      "Imagery: abstract product / signal / material photography; avoid stock handshake smiles.",
    ].join("\n"),
    designIntentMarkdown: `## Design Intent
- Mood: restrained, precise, technical, confident
- Color direction: Near-black base (#0b0f14), cool slate text, single teal accent (#5eead4). No purple, no warm cream.
- Style: Modern product-engineering landing page. Hairline rules, calm hierarchy, content-first.
- Keywords: cold, technical, precise, minimal, teal-accent, dark
`,
    technicalKeywords: ["cold", "technical", "minimal", "dark", "teal"],
  },
  {
    id: "warm-editorial",
    label: "温暖人文",
    tagline: "留白、编辑感、柔和对比",
    moods: ["温暖", "编辑感", "留白"],
    tokens: {
      background: "#f7f3ec",
      foreground: "#1c1917",
      muted: "#78716c",
      accent: "#0f766e",
      accentForeground: "#f0fdfa",
      border: "#e7e0d5",
      fontDisplay: "ui-serif, Georgia, serif",
      fontBody: "ui-sans-serif, system-ui, sans-serif",
      radius: "10px",
    },
    styleGuide: [
      "Direction: warm editorial / human brand storytelling.",
      "Palette: soft paper background, ink text, deep teal accent (not terracotta-on-cream cliché overload).",
      "Typography: display serif for headlines, clean sans for body; generous leading and whitespace.",
      "Decoration: calm photography frames, quiet rules; avoid neon, cyberpunk chrome, dense badge rows.",
      "Imagery: lifestyle / craft / people in natural light; avoid fake dashboard mock UIs in hero.",
    ].join("\n"),
    designIntentMarkdown: `## Design Intent
- Mood: warm, editorial, approachable, spacious
- Color direction: Soft paper (#f7f3ec), ink foreground, deep teal accent (#0f766e). Low saturation supporting tones.
- Style: Editorial brand landing. Serif headlines, generous whitespace, storytelling sections.
- Keywords: warm, editorial, spacious, serif, human, paper
`,
    technicalKeywords: ["warm", "editorial", "spacious", "serif", "human"],
  },
  {
    id: "bold-promo",
    label: "大胆促销",
    tagline: "高对比、大标题、强 CTA",
    moods: ["大胆", "有冲击", "转化"],
    tokens: {
      background: "#ffffff",
      foreground: "#09090b",
      muted: "#52525b",
      accent: "#e11d48",
      accentForeground: "#fff1f2",
      border: "#e4e4e7",
      fontDisplay: "ui-sans-serif, system-ui, sans-serif",
      fontBody: "ui-sans-serif, system-ui, sans-serif",
      radius: "14px",
    },
    styleGuide: [
      "Direction: bold promotional / high-conversion campaign landing.",
      "Palette: clean white/near-black contrast with one strong rose/red accent for CTAs.",
      "Typography: large confident sans headlines, short punchy copy blocks, clear CTA hierarchy.",
      "Decoration: strong geometric blocks and contrast; avoid muddy pastels and generic purple AI gradients.",
      "Imagery: product-forward, high-contrast; keep hero CTA impossible to miss.",
    ].join("\n"),
    designIntentMarkdown: `## Design Intent
- Mood: bold, energetic, conversion-focused, clear
- Color direction: White base, near-black type, single rose/red accent (#e11d48) for CTAs.
- Style: Campaign landing with oversized headlines, short proof points, dominant primary CTA.
- Keywords: bold, promotional, high-contrast, CTA, energetic, campaign
`,
    technicalKeywords: ["bold", "promotional", "high-contrast", "cta", "campaign"],
  },
];

export function getVibeDirection(id: string): VibeDirection | undefined {
  return VIBE_DIRECTIONS.find((v) => v.id === id);
}

/** Pull a short title from brief markdown for the mini-sample hero. */
export function extractBriefTitle(briefMarkdown: string | undefined | null): string {
  const text = (briefMarkdown ?? "").trim();
  if (!text) return "你的产品";

  const heading = text.match(/^#{1,3}\s+(.+)$/m);
  if (heading?.[1]?.trim()) {
    return clampTitle(heading[1].trim());
  }

  for (const line of text.split(/\n+/)) {
    const cleaned = line.replace(/^[-*•\d.)\s]+/, "").trim();
    if (cleaned.length >= 2 && !/^#+/.test(cleaned)) {
      return clampTitle(cleaned);
    }
  }

  return "你的产品";
}

function clampTitle(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 28) return oneLine;
  return `${oneLine.slice(0, 27)}…`;
}

export function buildVibeSelectUserMessage(vibe: VibeDirection): string {
  return [
    `气质方向已选定：${vibe.label}（${vibe.tagline}）。`,
    `后续设计系统与页面请严格按该视觉方向；若需求还需澄清请继续问，够清楚后再整理 brief 确认。`,
  ].join("\n");
}

/** @deprecated Prefer {@link buildVibeSelectUserMessage} for early vibe pick; kept for tests / generate-now paths. */
export function buildVibeConfirmUserMessage(vibe: VibeDirection): string {
  return [
    `就按这个需求生成。`,
    `气质方向已选定：${vibe.label}（${vibe.tagline}）。`,
    `请严格按该视觉方向做设计系统与页面实现，不要换成其他气质。`,
  ].join("\n");
}
