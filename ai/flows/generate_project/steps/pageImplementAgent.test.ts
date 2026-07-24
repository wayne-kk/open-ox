import { describe, expect, it } from "vitest";
import {
  pageImplementationIncompleteReason,
  pageImplementationRequiresToolCall,
  isPageImplementationValid,
  createPageFileSession,
} from "./pageImplementAgent";
import { InMemoryFileSessionWorkspace } from "@/ai/shared/fileSession/fileSession";
import { createPageImageAssetSession } from "../shared/pageImageCompletionPolicy";

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

  it("keeps a valid page complete when a shared contract rewrite is rejected", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default function Home() { return <main>Preparing your site…</main>; }",
      "components/shared/MatchCard.tsx":
        "export function MatchCard() { return <article>Match</article>; }",
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
    const rejected = await session.execute({
      name: "create_file",
      args: {
        path: "components/shared/MatchCard.tsx",
        content: "export function MatchCard() { return <article>Changed</article>; }",
      },
    });

    expect(rejected).toMatchObject({
      success: false,
      code: "PATH_NOT_OWNED",
      retryable: true,
    });
    expect(session.stopDecision()).toEqual({ kind: "complete" });
    expect((await workspace.read("components/shared/MatchCard.tsx")).content).toContain(
      "Match</article>",
    );
  });

  it("keeps image completion inside the file session and binds it to current revisions", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default function Home() { return <main>Preparing your site…</main>; }",
    });
    const images = createPageImageAssetSession({ assetExists: () => false });
    const session = createPageFileSession({
      slug: "home",
      targetPath: "app/page.tsx",
      componentRoot: "components/pages/home",
      workspace,
      validateCompletion: images.validateCompletion,
    });

    const placeholderSource = `export default function Home() { return <img src="https://picsum.photos/1200/800" />; }`;
    await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: placeholderSource,
      },
    });
    expect(session.stopDecision()).toMatchObject({ kind: "continue" });

    images.recordGeneratedAsset("/images/page-home-hero.png");
    const snapshot = await session.execute({
      name: "read_file_snapshot",
      args: { path: "app/page.tsx" },
    });
    const placeholder = "https://picsum.photos/1200/800";
    const placeholderStart = placeholderSource.indexOf(placeholder);
    await session.execute({
      name: "apply_file_patch",
      args: {
        path: "app/page.tsx",
        baseRevision: snapshot.revision!,
        edits: [{
          range: {
            start: { line: 0, character: placeholderStart },
            end: { line: 0, character: placeholderStart + placeholder.length },
          },
          newText: "/images/page-home-hero.png",
        }],
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });
});
