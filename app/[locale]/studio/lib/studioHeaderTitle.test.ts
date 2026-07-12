import { describe, expect, it } from "vitest";
import { resolveStudioHeaderTitle } from "./studioHeaderTitle";

describe("resolveStudioHeaderTitle", () => {
  it("prefers project name over any prompt-like leftover", () => {
    expect(
      resolveStudioHeaderTitle({
        projectName: "泡泡玛特宣传站",
        projectId: "2026-01-01_project",
      })
    ).toBe("泡泡玛特宣传站");
  });

  it("does not fall back to using the user prompt as the title", () => {
    // Regression: header used to render lastRunInput (userPrompt), e.g.
    // "搭建一个泡泡玛特宣传官网", even when project.name was already set.
    const title = resolveStudioHeaderTitle({
      projectName: "PopMart Landing",
      projectId: "id",
    });
    expect(title).toBe("PopMart Landing");
    expect(title).not.toContain("搭建一个");
  });

  it("truncates long project names", () => {
    const long = "这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的项目标题用来验证截断行为";
    expect(long.length).toBeGreaterThan(40);
    const title = resolveStudioHeaderTitle({
      projectName: long,
      projectId: "id",
      maxChars: 40,
    });
    expect(title).toBe(`${long.slice(0, 40)}…`);
  });

  it("falls back to a short project id when name is missing", () => {
    const id = "2026-07-12T01-02-03-000Z_my-longer-site-name";
    expect(
      resolveStudioHeaderTitle({
        projectName: null,
        projectId: id,
      })
    ).toBe(`${id.slice(0, 32)}…`);
  });
});
