import { describe, expect, it } from "vitest";
import {
  pageImplementationIncompleteReason,
  pageImplementationRequiresToolCall,
  isPageImplementationValid,
  createPageFileSession,
} from "./pageImplementAgent";
import { InMemoryFileSessionWorkspace } from "@/ai/shared/fileSession/fileSession";

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

  it("does not validate while the scaffold stub is still present", () => {
    const source = `export default function Home() {
      return <main>Preparing your site…</main>;
    }`;

    expect(isPageImplementationValid(source, path)).toBe(false);
    expect(pageImplementationRequiresToolCall(source, path)).toBe(true);
  });

  it("allows a final response only after the page has been implemented", () => {
    const source = `export default function Home() {
      return <main>Welcome</main>;
    }`;

    expect(isPageImplementationValid(source, path)).toBe(true);
    expect(pageImplementationRequiresToolCall(source, path)).toBe(false);
  });

  it("completes the Page file policy after replacing the bootstrap stub", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default function Home() { return <main>Preparing your site…</main>; }",
    });
    const session = createPageFileSession({
      slug: "home",
      targetPath: "app/page.tsx",
      componentRoot: "components/pages/home",
      workspace,
    });

    await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: "export default function Home() { return <main>Ready</main>; }",
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });
});
