import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  normalizeVibeTokensForContrast,
  parseHexColor,
} from "./vibeTokenContrast";
import type { VibeTokenPreview } from "./vibeDirections";

describe("vibeTokenContrast", () => {
  it("parses 3/6 digit hex", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("#0b0f14")).toEqual({ r: 11, g: 15, b: 20 });
  });

  it("reports low contrast for light-gray on white", () => {
    const ratio = contrastRatio("#ffffff", "#d4d4d8");
    expect(ratio).toBeLessThan(4.5);
  });

  it("lifts muted and accentForeground to readable contrast", () => {
    const raw: VibeTokenPreview = {
      background: "#ffffff",
      foreground: "#09090b",
      muted: "#e4e4e7", // nearly invisible on white
      accent: "#ff4d8d",
      accentForeground: "#ffb3cc", // poor on pink
      border: "#e4e4e7",
      fontDisplay: "sans-serif",
      fontBody: "sans-serif",
      radius: "10px",
    };

    const fixed = normalizeVibeTokensForContrast(raw);
    expect(contrastRatio(fixed.background, fixed.muted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fixed.accent, fixed.accentForeground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fixed.background, fixed.foreground)).toBeGreaterThanOrEqual(4.5);
    // Still secondary to foreground (not as dark/strong as body)
    expect(contrastRatio(fixed.background, fixed.muted)).toBeLessThan(
      contrastRatio(fixed.background, fixed.foreground) + 0.01
    );
  });

  it("fixes dark-on-dark muted", () => {
    const raw: VibeTokenPreview = {
      background: "#0a0a0a",
      foreground: "#fafafa",
      muted: "#1a1a1a",
      accent: "#a3e635",
      accentForeground: "#000000",
      border: "#27272a",
      fontDisplay: "sans-serif",
      fontBody: "sans-serif",
      radius: "8px",
    };
    const fixed = normalizeVibeTokensForContrast(raw);
    expect(contrastRatio(fixed.background, fixed.muted)).toBeGreaterThanOrEqual(4.5);
  });
});
