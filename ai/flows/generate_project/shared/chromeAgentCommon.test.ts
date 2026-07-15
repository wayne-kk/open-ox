import { describe, expect, it } from "vitest";
import {
  buildChromeLinkSurveyBlock,
  detectInPageChromeSignals,
  extractAnchorCandidateIds,
  pageFileToRoute,
  resolveShouldSkipGlobalChrome,
} from "./chromeAgentCommon";

describe("pageFileToRoute", () => {
  it("maps app/page.tsx to /", () => {
    expect(pageFileToRoute("app/page.tsx")).toBe("/");
  });

  it("maps nested routes and strips route groups", () => {
    expect(pageFileToRoute("app/pricing/page.tsx")).toBe("/pricing");
    expect(pageFileToRoute("app/(marketing)/about/page.tsx")).toBe("/about");
  });

  it("returns null for non-page files", () => {
    expect(pageFileToRoute("app/layout.tsx")).toBeNull();
    expect(pageFileToRoute("components/home/Hero.tsx")).toBeNull();
  });
});

describe("extractAnchorCandidateIds", () => {
  it("extracts section ids and ignores common form noise", () => {
    const src = `
      <section id="features">Features</section>
      <div id="pricing" className="x">Pricing</div>
      <input id="email" />
      <Checkbox id="remember" />
      <section id={"dynamic"}>Nope</section>
      <section id="hero-root">noise</section>
      <h2 id="hero-headline">noise</h2>
      <section
        id="hero"
        data-ox-id="hero-root"
        className="x"
      >
    `;
    expect(extractAnchorCandidateIds(src).sort()).toEqual([
      "features",
      "hero",
      "pricing",
    ]);
  });
});

describe("detectInPageChromeSignals", () => {
  it("flags CYBERPULSE-like stacked top nav + bottom tab chrome (duplicate-nav repro)", () => {
    const topNav = `
      export function StreamTopBar() {
        return (
          <nav className="sticky top-0 z-50 flex items-center gap-4">
            <a href="/">CP CYBERPULSE</a>
            <a href="#推荐">推荐</a>
            <a href="#热门">热门</a>
            <a href="#直播">直播</a>
            <button>搜索</button>
            <button>通知</button>
            <a href="/login">登录</a>
          </nav>
        );
      }
    `;
    const bottomTab = `
      export function StreamBottomNav() {
        return (
          <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-around">
            <a href="/">首页</a>
            <a href="/explore">探索</a>
            <button>+</button>
            <a href="/messages">消息</a>
            <a href="/me">我</a>
          </nav>
        );
      }
    `;
    const topSignals = detectInPageChromeSignals("components/home/StreamTopBar.tsx", topNav);
    const bottomSignals = detectInPageChromeSignals(
      "components/home/StreamBottomNav.tsx",
      bottomTab
    );
    const all = [...topSignals, ...bottomSignals];
    expect(all.some((s) => s.kind === "top-nav")).toBe(true);
    expect(all.some((s) => s.kind === "bottom-tab")).toBe(true);
    expect(resolveShouldSkipGlobalChrome(all)).toBe(true);
  });

  it("flags chrome-like filenames as strong signals", () => {
    const signals = detectInPageChromeSignals(
      "components/home/BottomNav.tsx",
      "export function BottomNav() { return <div /> }"
    );
    expect(signals.some((s) => s.kind === "chrome-filename" && s.strength === "strong")).toBe(
      true
    );
    expect(resolveShouldSkipGlobalChrome(signals)).toBe(true);
  });

  it("does not flag ordinary section content", () => {
    const hero = `
      export function Hero() {
        return (
          <section id="hero" className="relative min-h-screen">
            <h1>Pulse</h1>
            <a href="#features">See features</a>
            <a href="#cta">Get started</a>
          </section>
        );
      }
    `;
    expect(detectInPageChromeSignals("components/home/Hero.tsx", hero)).toEqual([]);
    expect(resolveShouldSkipGlobalChrome([])).toBe(false);
  });

  it("ignores components/ui and components/chrome paths", () => {
    const navish = `<nav className="sticky top-0"><a href="/">A</a><a href="/b">B</a></nav>`;
    expect(detectInPageChromeSignals("components/ui/navigation-menu.tsx", navish)).toEqual([]);
    expect(detectInPageChromeSignals("components/chrome/Navbar.tsx", navish)).toEqual([]);
  });
});

describe("buildChromeLinkSurveyBlock", () => {
  it("renders routes, section ids, and chrome files for the agent", () => {
    const block = buildChromeLinkSurveyBlock({
      routes: [{ route: "/", pageFile: "app/page.tsx" }],
      sectionIds: [{ id: "features", file: "components/home/Features.tsx" }],
      chromeFiles: [
        {
          path: "components/chrome/Navbar.tsx",
          content: "export function Navbar() { return null }",
        },
      ],
      inPageChromeSignals: [],
      shouldSkipGlobalChrome: false,
    });
    expect(block).toContain("## Disk survey");
    expect(block).toContain("`/` ← `app/page.tsx`");
    expect(block).toContain("`#features` ← `components/home/Features.tsx`");
    expect(block).toContain("components/chrome/Navbar.tsx");
    expect(block).toContain("do NOT re-survey");
    expect(block).toContain("pages look chrome-free");
  });

  it("surfaces planning hints when in-page chrome signals are strong", () => {
    const block = buildChromeLinkSurveyBlock({
      routes: [{ route: "/", pageFile: "app/page.tsx" }],
      sectionIds: [],
      chromeFiles: [],
      inPageChromeSignals: [
        {
          file: "components/home/StreamTopBar.tsx",
          kind: "top-nav",
          strength: "strong",
          evidence: "<nav> + sticky top",
        },
        {
          file: "components/home/StreamBottomNav.tsx",
          kind: "bottom-tab",
          strength: "strong",
          evidence: "fixed bottom tab bar",
        },
      ],
      shouldSkipGlobalChrome: true,
    });
    expect(block).toContain("Planning hint");
    expect(block).toContain("page-local");
    expect(block).toContain("StreamBottomNav.tsx");
    expect(block).not.toContain("SKIP global chrome");
  });
});
