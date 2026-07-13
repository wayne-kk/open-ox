import { describe, expect, it } from "vitest";
import {
  buildChromeLinkSurveyBlock,
  extractAnchorCandidateIds,
  pageFileToRoute,
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
    });
    expect(block).toContain("## Disk survey");
    expect(block).toContain("`/` ← `app/page.tsx`");
    expect(block).toContain("`#features` ← `components/home/Features.tsx`");
    expect(block).toContain("components/chrome/Navbar.tsx");
    expect(block).toContain("do NOT re-survey");
  });
});
