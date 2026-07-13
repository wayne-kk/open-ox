import { describe, expect, it } from "vitest";
import { parseGenerateVibeDirectionsPayload } from "./generateVibeDirections";

/**
 * Feedback loop: "气质三选一为何每个项目都一样"
 * GREEN when different brief fixtures yield different direction labels via the parser seam.
 */
describe("vibe directions should be brief-sensitive", () => {
  it("serves different label sets for unrelated brief fixtures", () => {
    const fixtureA = parseGenerateVibeDirectionsPayload({
      directions: [
        {
          id: "a1",
          label: "潮玩糖果",
          tagline: "高饱和点缀",
          moods: ["俏皮"],
          tokens: { accent: "#ff4d8d" },
          mood: "playful",
          colorDirection: "candy",
          style: "toy",
          keywords: ["toy"],
        },
        {
          id: "a2",
          label: "展厅克制",
          tagline: "白墙留白",
          moods: ["克制"],
          tokens: { accent: "#1d4ed8" },
          mood: "quiet",
          colorDirection: "gallery",
          style: "gallery",
          keywords: ["gallery"],
        },
        {
          id: "a3",
          label: "街头发售",
          tagline: "强促销",
          moods: ["大胆"],
          tokens: { accent: "#ef4444" },
          mood: "bold",
          colorDirection: "street",
          style: "drop",
          keywords: ["drop"],
        },
      ],
    });

    const fixtureB = parseGenerateVibeDirectionsPayload({
      directions: [
        {
          id: "b1",
          label: "临床安静",
          tagline: "浅蓝清晰",
          moods: ["冷静"],
          tokens: { accent: "#0ea5e9" },
          mood: "calm",
          colorDirection: "clinical",
          style: "health",
          keywords: ["clinical"],
        },
        {
          id: "b2",
          label: "照护温暖",
          tagline: "柔和米色",
          moods: ["温暖"],
          tokens: { accent: "#0f766e" },
          mood: "warm",
          colorDirection: "care",
          style: "care",
          keywords: ["care"],
        },
        {
          id: "b3",
          label: "信任稳重",
          tagline: "深蓝少饰",
          moods: ["信任"],
          tokens: { accent: "#1e3a8a" },
          mood: "trust",
          colorDirection: "navy",
          style: "trust",
          keywords: ["trust"],
        },
      ],
    });

    expect(fixtureA).not.toBeNull();
    expect(fixtureB).not.toBeNull();
    expect(new Set([JSON.stringify(fixtureA!.map((d) => d.label)), JSON.stringify(fixtureB!.map((d) => d.label))]).size).toBe(
      2
    );
  });
});
