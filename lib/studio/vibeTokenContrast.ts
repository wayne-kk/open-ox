import type { VibeTokenPreview } from "./vibeDirections";

export type Rgb = { r: number; g: number; b: number };

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Parse `#rgb` / `#rrggbb` / `#rrggbbaa` (alpha ignored). */
export function parseHexColor(hex: string): Rgb | null {
  const s = hex.trim();
  if (!HEX_RE.test(s)) return null;
  let h = s.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 8) h = h.slice(0, 6);
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(aHex: string, bHex: string): number {
  const a = parseHexColor(aHex);
  const b = parseHexColor(bHex);
  if (!a || !b) return 1;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/**
 * Mix `foreground` toward `background` until contrast hits the target band.
 * Prefer keeping LLM muted when already readable.
 */
export function ensureContrastAgainstBackground(
  backgroundHex: string,
  foregroundHex: string,
  candidateHex: string,
  minRatio = 4.5,
  preferSofterThanForeground = true
): string {
  const bg = parseHexColor(backgroundHex);
  const fg = parseHexColor(foregroundHex);
  const candidate = parseHexColor(candidateHex);
  if (!bg || !fg) return candidateHex;

  if (candidate && contrastRatio(backgroundHex, candidateHex) >= minRatio) {
    if (!preferSofterThanForeground) return candidateHex;
    // Keep candidate if it's not stronger than foreground (secondary text).
    if (contrastRatio(backgroundHex, candidateHex) <= contrastRatio(backgroundHex, foregroundHex) + 0.05) {
      return candidateHex;
    }
  }

  // Binary search mix amount: 0 = full foreground, 1 = background.
  let lo = 0;
  let hi = 0.85;
  let best = foregroundHex;
  for (let i = 0; i < 14; i += 1) {
    const mid = (lo + hi) / 2;
    const mixed = rgbToHex(mixRgb(fg, bg, mid));
    const ratio = contrastRatio(backgroundHex, mixed);
    if (ratio >= minRatio) {
      best = mixed;
      lo = mid; // try softer
    } else {
      hi = mid;
    }
  }
  return best;
}

export function ensureContrastOnFill(
  fillHex: string,
  candidateHex: string,
  lightFallback = "#ffffff",
  darkFallback = "#0a0a0a",
  minRatio = 4.5
): string {
  const fill = parseHexColor(fillHex);
  if (!fill) return candidateHex;
  if (parseHexColor(candidateHex) && contrastRatio(fillHex, candidateHex) >= minRatio) {
    return candidateHex;
  }
  const lightOk = contrastRatio(fillHex, lightFallback) >= minRatio;
  const darkOk = contrastRatio(fillHex, darkFallback) >= minRatio;
  if (lightOk && !darkOk) return lightFallback;
  if (darkOk && !lightOk) return darkFallback;
  // Prefer the higher-contrast option.
  return contrastRatio(fillHex, lightFallback) >= contrastRatio(fillHex, darkFallback)
    ? lightFallback
    : darkFallback;
}

/**
 * Post-process LLM vibe tokens so mini-sample body / muted / CTA text stay readable.
 * LLM often picks aesthetic "soft gray" muted that fails WCAG on the chosen background.
 */
export function normalizeVibeTokensForContrast(tokens: VibeTokenPreview): VibeTokenPreview {
  const background = tokens.background;
  let foreground = tokens.foreground;

  if (contrastRatio(background, foreground) < 4.5) {
    foreground = ensureContrastAgainstBackground(background, "#000000", tokens.foreground, 7);
    if (contrastRatio(background, foreground) < 4.5) {
      foreground = ensureContrastAgainstBackground(background, "#ffffff", tokens.foreground, 7);
    }
  }

  const muted = ensureContrastAgainstBackground(background, foreground, tokens.muted, 4.5, true);
  const accentForeground = ensureContrastOnFill(tokens.accent, tokens.accentForeground);

  return {
    ...tokens,
    foreground,
    muted,
    accentForeground,
  };
}
