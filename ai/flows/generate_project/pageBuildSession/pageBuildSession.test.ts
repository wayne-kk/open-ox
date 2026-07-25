import { describe, expect, it } from "vitest";
import {
  createFileSession,
  InMemoryFileSessionWorkspace,
  type FileSessionDiagnostic,
  type FileSessionMutationResult,
} from "@/ai/shared/fileSession/fileSession";
import { pageBuildPhase, pageBuildStateCard, toolsForPageBuildPhase } from "./pageBuildSession";

function fixture(holdCompletion = false) {
  const targetPath = "app/page.tsx";
  const componentRoot = "components/pages/home";
  const fileSession = createFileSession({
    owner: "page:home",
    workspace: new InMemoryFileSessionWorkspace(),
    ownsPath: (path) => path === targetPath || path.startsWith(`${componentRoot}/`),
    requiredArtifacts: [targetPath],
    validateArtifact: (_path, content) => content.includes("export default") ? null : "missing default export",
    ...(holdCompletion ? { validateCompletion: () => "assets pending" } : {}),
  });
  return { slug: "home", targetPath, componentRoot, fileSession };
}

class DiagnosticWorkspace extends InMemoryFileSessionWorkspace {
  override async createOrReplace(
    path: string,
    content: string,
    expectedRevision?: string,
  ): Promise<FileSessionMutationResult> {
    const result = await super.createOrReplace(path, content, expectedRevision);
    const diagnostics: FileSessionDiagnostic[] = content.includes("BROKEN")
      ? [{ path, message: "broken source" }]
      : [];
    return { ...result, diagnostics };
  }
}

describe("PageBuildSession state machine", () => {
  it("exposes only the target-page command before the first successful write", () => {
    const spec = fixture(true);
    expect(pageBuildPhase(spec)).toBe("draft_target");
    expect(toolsForPageBuildPhase(spec).map((tool) => tool.function.name)).toEqual(["create_target_page"]);
    expect(pageBuildStateCard(spec)).toContain("target_revision: missing");
  });

  it("opens component, revision replacement, verification, and image actions after target creation", async () => {
    const spec = fixture(true);
    await spec.fileSession.execute({
      name: "create_file",
      args: { path: spec.targetPath, content: "export default function Page() { return <main /> }" },
    });
    const assetLifecycle = {
      inspect: () => [],
      generation: {
        tool: { type: "function" as const, function: { name: "generate_image", parameters: { type: "object" } } },
        execute: async () => ({ success: true, output: "/images/a.png" }),
      },
    };
    expect(pageBuildPhase(spec)).toBe("build");
    expect(toolsForPageBuildPhase({ ...spec, assetLifecycle }).map((tool) => tool.function.name)).toEqual([
      "create_page_component", "read_page_file", "replace_page_file", "verify_page_files", "generate_image",
    ]);
  });

  it("requires a snapshot before replacement after a stale revision", async () => {
    const spec = fixture();
    await spec.fileSession.execute({
      name: "create_file",
      args: { path: spec.targetPath, content: "export default function Page() { return <main /> }" },
    });
    await spec.fileSession.execute({
      name: "replace_file",
      args: { path: spec.targetPath, baseRevision: "sha256:stale", content: "export default () => null" },
    });
    expect(toolsForPageBuildPhase(spec).map((tool) => tool.function.name)).toEqual(["read_page_file"]);
  });

  it("returns from repair to build after the current diagnostics are cleared", async () => {
    const targetPath = "app/page.tsx";
    const fileSession = createFileSession({
      owner: "page:home",
      workspace: new DiagnosticWorkspace(),
      ownsPath: (path) => path === targetPath,
      requiredArtifacts: [targetPath],
      validateCompletion: () => "assets pending",
    });
    const spec = { slug: "home", targetPath, componentRoot: "components/pages/home", fileSession };
    await fileSession.execute({
      name: "create_file",
      args: { path: targetPath, content: "BROKEN export default function Page() { return null }" },
    });
    expect(pageBuildPhase(spec)).toBe("repair");
    const snapshot = await fileSession.execute({ name: "read_file_snapshot", args: { path: targetPath } });
    await fileSession.execute({
      name: "replace_file",
      args: {
        path: targetPath,
        baseRevision: snapshot.revision!,
        content: "export default function Page() { return null }",
      },
    });
    expect(pageBuildPhase(spec)).toBe("build");
  });
});
