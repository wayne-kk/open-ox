import { describe, expect, it } from "vitest";
import {
  pageImplementationIncompleteReason,
  pageImplementationRequiresToolCall,
  shouldAcceptImplicitPageImplementation,
} from "./pageImplementAgent";

describe("pageImplementationIncompleteReason", () => {
  const path = "app/page.tsx";

  it("rejects the scaffold stub before the page agent may signal completion", () => {
    const source = `export default function Home() {
      return <main>Preparing your site…</main>;
    }`;

    expect(pageImplementationIncompleteReason(source, path)).toContain("default stub");
  });

  it("rejects an empty or invalid target page", () => {
    expect(pageImplementationIncompleteReason("", path)).toContain("empty or missing");
    expect(pageImplementationIncompleteReason("export const Home = () => null", path)).toContain(
      "default export"
    );
  });

  it("accepts an implemented page with a default export", () => {
    const source = `export default function Home() {
      return <main>Welcome</main>;
    }`;

    expect(pageImplementationIncompleteReason(source, path)).toBeNull();
  });

  it("does not implicitly complete while the scaffold stub is still present", () => {
    const source = `export default function Home() {
      return <main>Preparing your site…</main>;
    }`;

    expect(shouldAcceptImplicitPageImplementation(source, path)).toBe(false);
    expect(pageImplementationRequiresToolCall(source, path)).toBe(true);
  });

  it("allows a final response only after the page has been implemented", () => {
    const source = `export default function Home() {
      return <main>Welcome</main>;
    }`;

    expect(shouldAcceptImplicitPageImplementation(source, path)).toBe(true);
    expect(pageImplementationRequiresToolCall(source, path)).toBe(false);
  });
});
