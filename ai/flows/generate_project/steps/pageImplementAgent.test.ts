import { describe, expect, it } from "vitest";
import { pageImplementationIncompleteReason } from "./pageImplementAgent";

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
});
