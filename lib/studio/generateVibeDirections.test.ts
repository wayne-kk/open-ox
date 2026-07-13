import { describe, expect, it } from "vitest";
import { parseGenerateVibeDirectionsPayload } from "./generateVibeDirections";
import { contrastRatio } from "./vibeTokenContrast";

function directionFixture(overrides: {
  id: string;
  label: string;
  tagline: string;
  accent: string;
  muted?: string;
  background?: string;
  foreground?: string;
}) {
  return {
    id: overrides.id,
    label: overrides.label,
    tagline: overrides.tagline,
    moods: ["A", "B", "C"],
    tokens: {
      background: overrides.background ?? "#ffffff",
      foreground: overrides.foreground ?? "#111111",
      muted: overrides.muted ?? "#eeeeee",
      accent: overrides.accent,
      accentForeground: "#ffffff",
      border: "#e5e5e5",
      fontDisplay: "ui-sans-serif, system-ui, sans-serif",
      fontBody: "ui-sans-serif, system-ui, sans-serif",
      radius: "10px",
    },
    mood: "playful, collectible",
    colorDirection: "Candy accents on charcoal",
    style: "toy-community-editorial",
    keywords: ["toy", "collectible", "community"],
    paletteNote: "Charcoal + candy accent",
    typographyNote: "Rounded sans display",
    decorationNote: "Soft shapes, little chrome",
    imageryNote: "Blind-box product photography",
    forbidden: ["corporate blue", "stock handshakes"],
  };
}

describe("parseGenerateVibeDirectionsPayload", () => {
  it("maps three brief-specific directions with distinct labels", () => {
    const popMart = parseGenerateVibeDirectionsPayload({
      directions: [
        directionFixture({
          id: "candy-collector",
          label: "潮玩糖果",
          tagline: "高饱和点缀、收藏感",
          accent: "#ff4d8d",
        }),
        directionFixture({
          id: "gallery-quiet",
          label: "展厅克制",
          tagline: "白墙、大留白、物影",
          accent: "#1d4ed8",
        }),
        directionFixture({
          id: "street-drop",
          label: "街头发售",
          tagline: "高对比、强促销节奏",
          accent: "#ef4444",
        }),
      ],
    });

    const hospital = parseGenerateVibeDirectionsPayload({
      directions: [
        directionFixture({
          id: "clinical-calm",
          label: "临床安静",
          tagline: "浅蓝、清晰层级",
          accent: "#0ea5e9",
        }),
        directionFixture({
          id: "care-warm",
          label: "照护温暖",
          tagline: "柔和米色、亲和",
          accent: "#0f766e",
        }),
        directionFixture({
          id: "trust-solid",
          label: "信任稳重",
          tagline: "深蓝主色、少装饰",
          accent: "#1e3a8a",
        }),
      ],
    });

    expect(popMart).toHaveLength(3);
    expect(hospital).toHaveLength(3);
    expect(popMart!.map((d) => d.label)).toEqual(["潮玩糖果", "展厅克制", "街头发售"]);
    expect(hospital!.map((d) => d.label)).toEqual(["临床安静", "照护温暖", "信任稳重"]);
    expect(JSON.stringify(popMart!.map((d) => d.label))).not.toEqual(
      JSON.stringify(hospital!.map((d) => d.label))
    );
    expect(popMart![0]!.designIntentMarkdown).toContain("Mood:");
    expect(popMart![0]!.styleGuide).toContain("Forbidden:");
  });

  it("normalizes unreadable muted against background", () => {
    const parsed = parseGenerateVibeDirectionsPayload({
      directions: [
        directionFixture({
          id: "light-bad-muted",
          label: "浅色",
          tagline: "浅灰副文案",
          accent: "#ff4d8d",
          background: "#ffffff",
          foreground: "#111111",
          muted: "#f0f0f0",
        }),
        directionFixture({
          id: "dark-bad-muted",
          label: "深色",
          tagline: "深灰副文案",
          accent: "#a3e635",
          background: "#0a0a0a",
          foreground: "#fafafa",
          muted: "#151515",
        }),
        directionFixture({
          id: "mid",
          label: "中间",
          tagline: "正常",
          accent: "#0f766e",
          background: "#f7f3ec",
          foreground: "#1c1917",
          muted: "#eeeeee",
        }),
      ],
    });

    expect(parsed).toHaveLength(3);
    for (const direction of parsed!) {
      expect(contrastRatio(direction.tokens.background, direction.tokens.muted)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  it("returns null when fewer than three valid directions", () => {
    expect(parseGenerateVibeDirectionsPayload({ directions: [] })).toBeNull();
    expect(
      parseGenerateVibeDirectionsPayload({
        directions: [directionFixture({ id: "a", label: "A", tagline: "a", accent: "#fff" })],
      })
    ).toBeNull();
  });
});
