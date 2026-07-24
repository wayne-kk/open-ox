import { describe, expect, it } from "vitest";
import {
  createFileSession,
  InMemoryFileSessionWorkspace,
} from "./fileSession";

function createSession() {
  const workspace = new InMemoryFileSessionWorkspace({
    "app/page.tsx": `export default function Home() { return <main>Preparing your site…</main>; }`,
  });
  const session = createFileSession({
    owner: "page:home",
    workspace,
    ownsPath: (path) => path === "app/page.tsx" || path.startsWith("components/pages/home/"),
    requiredArtifacts: ["app/page.tsx"],
    replaceableBaselinePaths: ["app/page.tsx"],
    validateArtifact: (path, content) =>
      path === "app/page.tsx" && content.includes("Preparing your site")
        ? "page is still the bootstrap stub"
        : null,
  });
  return { session, workspace };
}

describe("FileSession", () => {
  it("evaluates completion validators against the current artifact revisions", async () => {
    const workspace = new InMemoryFileSessionWorkspace();
    const session = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === "app/page.tsx",
      requiredArtifacts: ["app/page.tsx"],
      validateCompletion: ({ artifacts }) =>
        artifacts.get("app/page.tsx")?.content ===
        "export default () => <img src='placeholder' />"
          ? "page still contains a placeholder"
          : null,
    });

    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default () => <img src='placeholder' />" },
    });
    expect(session.stopDecision()).toEqual({
      kind: "continue",
      reason: "page still contains a placeholder",
    });

    const snapshot = await session.execute({
      name: "read_file_snapshot",
      args: { path: "app/page.tsx" },
    });
    expect(session.stopDecision()).toEqual({
      kind: "continue",
      reason: "page still contains a placeholder",
    });
    await session.execute({
      name: "apply_file_patch",
      args: {
        path: "app/page.tsx",
        baseRevision: snapshot.revision!,
        edits: [{
          range: { start: { line: 0, character: 32 }, end: { line: 0, character: 43 } },
          newText: "/images/hero.png",
        }],
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("excludes read-only records from completion validation", async () => {
    const workspace = new InMemoryFileSessionWorkspace({
      "app/page.tsx": "export default () => <main>Ready</main>",
      "components/pages/home/Legacy.tsx": "export const legacy = 'placeholder'",
    });
    const session = createFileSession({
      owner: "page:home",
      workspace,
      ownsPath: (path) => path === "app/page.tsx" || path.startsWith("components/pages/home/"),
      requiredArtifacts: ["app/page.tsx"],
      replaceableBaselinePaths: ["app/page.tsx"],
      validateCompletion: ({ artifacts }) =>
        [...artifacts.values()].some((artifact) => artifact.content.includes("placeholder"))
          ? "written source contains a placeholder"
          : null,
    });
    await session.execute({ name: "read_file_snapshot", args: { path: "components/pages/home/Legacy.tsx" } });
    await session.execute({
      name: "create_file",
      args: { path: "app/page.tsx", content: "export default () => <main>Ready</main>" },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("makes duplicate create delivery idempotent and rejects a different overwrite", async () => {
    const { session, workspace } = createSession();
    const call = {
      name: "create_file" as const,
      args: {
        path: "components/pages/home/Hero.tsx",
        content: "export function Hero() { return <h1>Hello</h1>; }",
      },
    };

    const created = await session.execute(call);
    const duplicate = await session.execute(call);
    const overwrite = await session.execute({
      name: "create_file",
      args: {
        ...call.args,
        content: "export function Hero() { return <h1>Changed</h1>; }",
      },
    });

    expect(created).toMatchObject({ success: true, kind: "file_created", cached: false });
    expect(duplicate).toMatchObject({ success: true, kind: "file_created", cached: true });
    expect(overwrite).toMatchObject({ success: false, code: "FILE_ALREADY_CREATED" });
    expect(await workspace.readText(call.args.path)).toContain("Hello");
    expect(session.events()).toHaveLength(1);
  });

  it("serializes concurrent creates so one path has exactly one mutation", async () => {
    const { session, workspace } = createSession();
    const [first, second] = await Promise.all([
      session.execute({
        name: "create_file",
        args: { path: "components/pages/home/Hero.tsx", content: "export const value = 1;" },
      }),
      session.execute({
        name: "create_file",
        args: { path: "components/pages/home/Hero.tsx", content: "export const value = 2;" },
      }),
    ]);

    expect([first.success, second.success].filter(Boolean)).toHaveLength(1);
    expect([first.code, second.code]).toContain("FILE_ALREADY_CREATED");
    expect(await workspace.readText("components/pages/home/Hero.tsx")).toContain("value = 1");
    expect(session.events()).toHaveLength(1);
  });

  it("turns repeated protocol failures into a terminal decision", async () => {
    const { session } = createSession();
    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 1" },
    });

    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 2" },
    });
    expect(session.stopDecision().kind).toBe("continue");
    await session.execute({
      name: "create_file",
      args: { path: "components/pages/home/Hero.tsx", content: "export const value = 3" },
    });

    expect(session.stopDecision()).toMatchObject({ kind: "failed" });
  });

  it("applies patches only to the current snapshot revision", async () => {
    const { session, workspace } = createSession();
    await session.execute({
      name: "create_file",
      args: {
        path: "components/pages/home/Hero.tsx",
        content: "export function Hero() { return <h1>Hello</h1>; }",
      },
    });
    await session.execute({
      name: "read_file_snapshot",
      args: { path: "components/pages/home/Hero.tsx" },
    });
    const edits = [
      {
        range: {
          start: { line: 0, character: 36 },
          end: { line: 0, character: 41 },
        },
        newText: "Welcome",
      },
    ];

    const stale = await session.execute({
      name: "apply_file_patch",
      args: {
        path: "components/pages/home/Hero.tsx",
        baseRevision: "sha256:stale",
        edits,
      },
    });
    const refreshed = await session.execute({
      name: "read_file_snapshot",
      args: { path: "components/pages/home/Hero.tsx" },
    });
    const updated = await session.execute({
      name: "apply_file_patch",
      args: {
        path: "components/pages/home/Hero.tsx",
        baseRevision: refreshed.revision!,
        edits,
      },
    });

    expect(stale).toMatchObject({ success: false, code: "STALE_REVISION" });
    expect(updated).toMatchObject({ success: true, kind: "file_updated" });
    expect(await workspace.readText("components/pages/home/Hero.tsx")).toContain("Welcome");
  });

  it("derives completion from required artifacts instead of a model completion call", async () => {
    const { session } = createSession();
    expect(session.stopDecision()).toMatchObject({ kind: "continue" });

    await session.execute({
      name: "create_file",
      args: {
        path: "app/page.tsx",
        content: "export default function Home() { return <main>Ready</main>; }",
      },
    });

    expect(session.stopDecision()).toEqual({ kind: "complete" });
  });

  it("rejects verification outside the session ownership boundary", async () => {
    const { session } = createSession();
    const result = await session.execute({
      name: "verify_files",
      args: { paths: ["app/layout.tsx"] },
    });

    expect(result).toMatchObject({ success: false, code: "PATH_NOT_OWNED" });
    expect(session.stopDecision()).toMatchObject({ kind: "failed" });
  });
});
