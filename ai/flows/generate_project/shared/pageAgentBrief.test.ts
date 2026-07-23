import { describe, expect, it } from "vitest";
import {
  buildPageAgentUserMessage,
  PAGE_AGENT_HERO_SKILL_PATH,
} from "./pageAgentBrief";
import {
  compactPageAgentMessages,
  createBootstrapGuardedReadExecutor,
  createPageAgentSessionState,
  filterPageAgentToolsForPhase,
  formatPageAgentToolResultForModel,
  isPageAgentForbiddenWritePath,
  isPageAgentOwnedWritePath,
  normalizeAgentRelativePath,
  PAGE_AGENT_ACT_TOOL_NAMES,
  PAGE_AGENT_TOOL_NAMES,
  resolvePageAgentMaxIterations,
  shouldRunPageAgentCompaction,
} from "./pageAgentToolLoop";
import type { ChatMessage } from "@/ai/shared/llm/types";

describe("pageAgentBrief", () => {
  it("buildPageAgentUserMessage focuses on task and bootstrap note", () => {
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
      userProvidedFileHint: "",
      userProvidedImagesBlock: "",
      userImageCount: 0,
      completeToolName: "page_implementation_complete",
    });
    expect(msg).toContain("Workspace context");
    expect(msg).toContain("design-system.md");
    expect(msg).toContain("do not re-read");
    expect(msg).toContain("Implement this route only");
    expect(msg).toContain("chrome-first");
    expect(msg).toContain("site-wide Nav/Navbar/Header/Sidebar/Footer");
    expect(msg).toContain("bottom tab bars");
    expect(msg).toContain("exactly one `write_file` or `edit_file` call per response");
    expect(msg).toContain("Write page-local components under");
    expect(msg).toContain("Write `app/page.tsx` last and only once");
    expect(msg).toContain("use `edit_file` only for the smallest required fix");
    expect(msg).not.toContain("parallel `write_file`");
    expect(msg).not.toContain(PAGE_AGENT_HERO_SKILL_PATH);
    expect(msg.length).toBeLessThan(4_500);
  });

  it("screenshot replica layout contract allows in-page chrome", () => {
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
      userProvidedFileHint: "",
      userProvidedImagesBlock: "",
      userImageCount: 0,
      completeToolName: "page_implementation_complete",
      screenshotReplicaLayout: true,
    });
    expect(msg).toContain("screenshot replicate");
    expect(msg).toContain("Reproduce header/nav/footer");
    expect(msg).not.toContain("chrome deferred");
  });

  it("never references hero skill path", () => {
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
      userProvidedFileHint: "",
      userProvidedImagesBlock: "",
      userImageCount: 0,
      completeToolName: "page_implementation_complete",
    });
    expect(msg).not.toContain(PAGE_AGENT_HERO_SKILL_PATH);
    expect(msg).not.toContain("hero skill");
  });
});

describe("pageAgentToolLoop", () => {
  it("normalizeAgentRelativePath normalizes slashes", () => {
    expect(normalizeAgentRelativePath("./app/layout.tsx")).toBe("app/layout.tsx");
  });

  it("isPageAgentForbiddenWritePath blocks layout and chrome", () => {
    expect(isPageAgentForbiddenWritePath("app/layout.tsx")).toBe(true);
    expect(isPageAgentForbiddenWritePath("app/globals.css")).toBe(true);
    expect(isPageAgentForbiddenWritePath("components/chrome/Navbar.tsx")).toBe(true);
    expect(isPageAgentForbiddenWritePath("components/home/Hero.tsx")).toBe(false);
    expect(isPageAgentForbiddenWritePath("app/page.tsx")).toBe(false);
  });

  it("limits a page worker to its route and component namespace", () => {
    const ownership = {
      targetPath: "app/about/page.tsx",
      componentRoot: "components/pages/about",
    };
    expect(isPageAgentOwnedWritePath("app/about/page.tsx", ownership)).toBe(true);
    expect(isPageAgentOwnedWritePath("components/pages/about/Hero.tsx", ownership)).toBe(true);
    expect(isPageAgentOwnedWritePath("app/page.tsx", ownership)).toBe(false);
    expect(isPageAgentOwnedWritePath("components/pages/home/Hero.tsx", ownership)).toBe(false);
    expect(isPageAgentOwnedWritePath("components/Hero.tsx", ownership)).toBe(false);
    expect(isPageAgentOwnedWritePath("components/pages/about/../home/Hero.tsx", ownership)).toBe(
      false
    );
    expect(isPageAgentOwnedWritePath("components/pages/about/../../chrome/Nav.tsx", ownership)).toBe(
      false
    );
    expect(isPageAgentOwnedWritePath("/components/pages/about/Hero.tsx", ownership)).toBe(false);
    expect(isPageAgentOwnedWritePath("", ownership)).toBe(false);
  });

  it("does not expose mutation tools that bypass page ownership", () => {
    expect(PAGE_AGENT_TOOL_NAMES).toEqual(
      expect.arrayContaining(["read_file", "write_file", "edit_file", "generate_image"])
    );
    expect(PAGE_AGENT_TOOL_NAMES).not.toContain("exec_shell");
    expect(PAGE_AGENT_TOOL_NAMES).not.toContain("install_package");
    expect(PAGE_AGENT_TOOL_NAMES).not.toContain("revert_file");
    expect(PAGE_AGENT_ACT_TOOL_NAMES.every((name) => PAGE_AGENT_TOOL_NAMES.includes(name))).toBe(
      true
    );
  });

  it("resolvePageAgentMaxIterations defaults to 96", () => {
    const prev = process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS;
    delete process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS;
    expect(resolvePageAgentMaxIterations()).toBe(96);
    if (prev !== undefined) process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS = prev;
  });

  it("formatPageAgentToolResultForModel shortens successful write_file", () => {
    const out = formatPageAgentToolResultForModel({
      name: "write_file",
      args: { path: "app/page.tsx", content: "a\nb\nc\n" },
      result: {
        success: true,
        output: "Written to app/page.tsx with long diagnostics...",
        meta: { path: "app/page.tsx", verifyErrorCount: 0, fixWarningCount: 0 },
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
    const state = createPageAgentSessionState("bootstrap note");
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
    compactPageAgentMessages(messages, state, { keepRecent: 2, preserveHeadCount: 2 });
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[2].role).toBe("system");
    expect(String(messages[2].content)).toContain("app/page.tsx");
    expect(String(messages[2].content)).toContain("Do NOT re-read bootstrap");
    expect(messages.at(-1)?.content).toBe("t3");
    expect(messages.length).toBe(5);
  });

  it("shouldRunPageAgentCompaction waits until first write", () => {
    const state = createPageAgentSessionState();
    expect(shouldRunPageAgentCompaction(state, 10, 8)).toBe(false);
    state.writtenPaths.push("app/page.tsx");
    expect(shouldRunPageAgentCompaction(state, 6, 8)).toBe(false);
    expect(shouldRunPageAgentCompaction(state, 7, 8)).toBe(true);
  });

  it("filterPageAgentToolsForPhase hides observe tools in act mode", () => {
    const tools = [
      { type: "function" as const, function: { name: "read_file", parameters: { type: "object" } } },
      { type: "function" as const, function: { name: "write_file", parameters: { type: "object" } } },
    ];
    const actOnly = filterPageAgentToolsForPhase(tools, false);
    expect(actOnly.map((t) => t.function?.name)).toEqual(["write_file"]);
  });

  it("createBootstrapGuardedReadExecutor blocks bootstrap paths", async () => {
    const paths = new Set(["design-system.md"]);
    const exec = createBootstrapGuardedReadExecutor(paths);
    const result = await exec({ path: "design-system.md" });
    expect(typeof result).toBe("object");
    if (typeof result === "object" && result && "output" in result) {
      expect(String(result.output)).toContain("Already in workspace bootstrap");
    }
  });
});
