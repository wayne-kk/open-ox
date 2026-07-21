import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "ai/flows/generate_project/prompts");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("aesthetic authority prompts", () => {
  it("section.default no longer hard-locks type size / py-32 / grain", () => {
    const text = read("rules/section.default.md");
    expect(text).toContain("审美默认（Visual Contract 可覆盖）");
    expect(text).not.toMatch(/禁止使用大于 `text-5xl`/);
    expect(text).not.toMatch(/禁止使用包装类：`py-32`/);
    expect(text).not.toMatch(/禁止在区块组件内注入页面级固定叠加层/);
  });

  it("design system Hard Rules defer ceilings to Visual Contract", () => {
    const text = read("steps/generateProjectDesignSystem.md");
    expect(text).toMatch(/Aesthetic ceilings live in \*\*Visual Contract/);
    expect(text).not.toMatch(/Never `text-6xl` or above/);
    expect(text).not.toMatch(/Use solid color backgrounds only/);
  });

  it("pageImplementAgent states design-system > engineering", () => {
    const text = read("steps/pageImplementAgent.md");
    expect(text).toContain("完整 **`design-system.md`**");
    expect(text).toContain("Visual Contract / Bold Factor");
    expect(text).not.toContain("hero skill");
  });

  it("bans stock image CDNs in page agent + section.default", () => {
    const page = read("steps/pageImplementAgent.md");
    const section = read("rules/section.default.md");
    for (const text of [page, section]) {
      expect(text).toMatch(/unsplash/i);
      expect(text).toMatch(/picsum/i);
      expect(text).toMatch(/placehold\.co/i);
    }
    expect(section).toMatch(/禁止.*股票|股票.*禁止|不得用股票/);
  });
});
