import { describe, expect, it } from "vitest";
import { getStepChapterTitle } from "@/app/[locale]/studio/lib/narratives";

describe("getStepChapterTitle", () => {
  it("maps core pipeline steps to chapter titles", () => {
    expect(getStepChapterTitle("analyze_project_requirement")).toBe("① 理解需求");
    expect(getStepChapterTitle("plan_project")).toBe("② 规划站点");
    expect(getStepChapterTitle("match_design_system_skill")).toBe("③ 匹配设计 Skill");
    expect(getStepChapterTitle("verify_build")).toBe("⑥ 构建验证");
  });

  it("returns null for tool-call noise", () => {
    expect(getStepChapterTitle("tool_call:search")).toBeNull();
    expect(getStepChapterTitle("page_agent_tool:write")).toBeNull();
  });

  it("labels page implement steps", () => {
    expect(getStepChapterTitle("page_implement_agent:home")).toBe("⑤ 实现页面 · home");
  });
});
