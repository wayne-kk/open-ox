import { describe, expect, it } from "vitest";
import {
  buildPageAgentUserMessage,
  PAGE_AGENT_DESIGN_SYSTEM_PATH,
  PAGE_AGENT_GLOBALS_PATH,
  PAGE_AGENT_HERO_SKILL_PATH,
  PAGE_AGENT_LAYOUT_PATH,
} from "./pageAgentBrief";
import {
  compactPageAgentMessages,
  createPageAgentSessionState,
  formatPageAgentToolResultForModel,
  normalizeAgentRelativePath,
  resolvePageAgentMaxIterations,
} from "./pageAgentToolLoop";
import type { ChatMessage } from "@/ai/shared/llm/types";

describe("pageAgentBrief", () => {
  it("buildPageAgentUserMessage lists on-disk paths instead of inlining content", () => {
    const hugeDs = "x".repeat(20_000);
    const msg = buildPageAgentUserMessage({
      targetPath: "app/page.tsx",
      slug: "home",
      pageTitle: "Home",
      pageDescription: "Landing",
      journeyStage: "awareness",
      planJson: "{}",
      projectTitle: "P",
      projectDescription: "D",
      language: "en",
      designKeywords: ["clean"],
      heroSkillId: "hero-x",
      heroSkillOnDisk: true,
      userProvidedFileHint: "",
      userProvidedImagesBlock: "",
      userImageCount: 0,
      completeToolName: "page_implementation_complete",
    });
    expect(msg).toContain(PAGE_AGENT_DESIGN_SYSTEM_PATH);
    expect(msg).toContain(PAGE_AGENT_LAYOUT_PATH);
    expect(msg).toContain(PAGE_AGENT_GLOBALS_PATH);
    expect(msg).toContain(PAGE_AGENT_HERO_SKILL_PATH);
    expect(msg).toContain("read_file");
    expect(msg).not.toContain(hugeDs);
    expect(msg.length).toBeLessThan(4_000);
  });

  it("omits hero skill path when not on disk", () => {
    const msg = buildPageAgentUserMessage({
      targetPath: "app/page.tsx",
      slug: "home",
      pageTitle: "Home",
      pageDescription: "Landing",
      journeyStage: "awareness",
      planJson: "{}",
      projectTitle: "P",
      projectDescription: "D",
      language: "en",
      designKeywords: [],
      heroSkillOnDisk: false,
      userProvidedFileHint: "",
      userProvidedImagesBlock: "",
      userImageCount: 0,
      completeToolName: "page_implementation_complete",
    });
    expect(msg).not.toContain(PAGE_AGENT_HERO_SKILL_PATH);
  });
});

describe("pageAgentToolLoop", () => {
  it("normalizeAgentRelativePath normalizes slashes", () => {
    expect(normalizeAgentRelativePath("./app/layout.tsx")).toBe("app/layout.tsx");
  });

  it("resolvePageAgentMaxIterations defaults to 24", () => {
    const prev = process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS;
    delete process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS;
    expect(resolvePageAgentMaxIterations()).toBe(24);
    if (prev !== undefined) process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS = prev;
  });

  it("formatPageAgentToolResultForModel shortens successful write_file", () => {
    const out = formatPageAgentToolResultForModel({
      name: "write_file",
      args: { path: "app/page.tsx", content: "a\nb\nc\n" },
      result: {
        success: true,
        output: "Written to app/page.tsx with long diagnostics...",
        meta: { path: "app/page.tsx", verifyErrorCount: 0, verifyWarningCount: 0 },
      },
    });
    expect(out).toMatch(/^✓ wrote app\/page\.tsx/);
    expect(out).not.toContain("long diagnostics");
  });

  it("formatPageAgentToolResultForModel keeps errors verbose", () => {
    const out = formatPageAgentToolResultForModel({
      name: "write_file",
      args: { path: "app/page.tsx" },
      result: { success: false, error: "disk full" },
    });
    expect(out).toContain("disk full");
  });

  it("compactPageAgentMessages preserves head and tail", () => {
    const state = createPageAgentSessionState();
    state.writtenPaths.push("app/page.tsx");
    const messages: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "user" },
      { role: "assistant", content: "old1" },
      { role: "tool", tool_call_id: "a", content: "t1" },
      { role: "assistant", content: "old2" },
      { role: "tool", tool_call_id: "b", content: "t2" },
      { role: "assistant", content: "recent" },
      { role: "tool", tool_call_id: "c", content: "t3" },
    ];
    compactPageAgentMessages(messages, state, { keepRecent: 2 });
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[2].role).toBe("system");
    expect(String(messages[2].content)).toContain("app/page.tsx");
    expect(messages.at(-1)?.content).toBe("t3");
    expect(messages.length).toBe(5);
  });
});
