import {
  buildVibeConfirmUserMessage,
  buildVibeSelectUserMessage,
  extractBriefTitle,
  getVibeDirection,
  VIBE_DIRECTIONS,
} from "./vibeDirections";

describe("vibeDirections", () => {
  it("exposes exactly three selectable directions", () => {
    expect(VIBE_DIRECTIONS).toHaveLength(3);
    expect(VIBE_DIRECTIONS.map((v) => v.id)).toEqual([
      "cold-tech",
      "warm-editorial",
      "bold-promo",
    ]);
  });

  it("resolves a direction by id", () => {
    expect(getVibeDirection("cold-tech")?.label).toBe("冷淡科技");
    expect(getVibeDirection("missing")).toBeUndefined();
  });

  it("extracts title from markdown heading", () => {
    expect(extractBriefTitle("# Acme Analytics\n\n给增长团队用的面板")).toBe("Acme Analytics");
  });

  it("falls back when brief is empty", () => {
    expect(extractBriefTitle("")).toBe("你的产品");
    expect(extractBriefTitle(null)).toBe("你的产品");
  });

  it("builds an early select message without forcing generate", () => {
    const vibe = getVibeDirection("bold-promo")!;
    const msg = buildVibeSelectUserMessage(vibe);
    expect(msg).toContain("大胆促销");
    expect(msg).toContain("气质方向已选定");
    expect(msg).not.toContain("就按这个需求生成");
  });

  it("builds a confirm message that names the vibe", () => {
    const vibe = getVibeDirection("bold-promo")!;
    const msg = buildVibeConfirmUserMessage(vibe);
    expect(msg).toContain("大胆促销");
    expect(msg).toContain("就按这个需求生成");
  });
});
