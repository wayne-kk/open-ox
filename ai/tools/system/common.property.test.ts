// Feature: multi-project-workspace, Property 2: Generated files land in the correct project directory
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import path from "path";
import {
  WORKSPACE_ROOT,
  getSiteRoot,
  setSiteRoot,
  resolvePath,
  runWithSiteRoot,
  tryGetSiteRoot,
} from "./common";

/**
 * Validates: Requirements 1.2
 *
 * Property 2: Generated files land in the correct project directory.
 * For any project ID, all files written by Generate_Flow must have paths that
 * begin with `sites/{project-id}/` and must not exist under any other project's
 * directory.
 *
 * The site root is bound per-async-context via runWithSiteRoot — there is no
 * module-level fallback. Tests must wrap every assertion in a runWithSiteRoot
 * scope.
 */

const projectIdArb = fc
  .stringMatching(/^[a-z0-9][a-z0-9\-_]{0,50}[a-z0-9]$/)
  .filter((s) => !s.includes("..") && s.length >= 2 && s !== "template");

const relativeFilePathArb = fc
  .array(fc.stringMatching(/^[a-z0-9_\-]+(\.[a-z]{1,5})?$/), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join("/"))
  .filter((p) => p.length > 0);

describe("Property 2: Generated files land in the correct project directory", () => {
  it("getSiteRoot / setSiteRoot / resolvePath all throw when called outside runWithSiteRoot", () => {
    expect(() => getSiteRoot()).toThrow(/runWithSiteRoot/);
    expect(() =>
      setSiteRoot(path.join(WORKSPACE_ROOT, "sites", "outside-context"))
    ).toThrow(/runWithSiteRoot/);
    expect(() => resolvePath("foo.tsx")).toThrow();
    expect(tryGetSiteRoot()).toBeNull();
  });

  it("runWithSiteRoot exposes the bound root via getSiteRoot for any valid project ID", async () => {
    await fc.assert(
      fc.asyncProperty(projectIdArb, async (projectId) => {
        const expectedRoot = path.join(WORKSPACE_ROOT, "sites", projectId);
        await runWithSiteRoot(expectedRoot, async () => {
          expect(getSiteRoot()).toBe(expectedRoot);
          expect(
            getSiteRoot().startsWith(path.join(WORKSPACE_ROOT, "sites") + path.sep)
          ).toBe(true);
        });
      }),
      { numRuns: 50 }
    );
  });

  it("resolvePath always produces paths under the bound site root", async () => {
    await fc.assert(
      fc.asyncProperty(projectIdArb, relativeFilePathArb, async (projectId, relPath) => {
        const root = path.join(WORKSPACE_ROOT, "sites", projectId);
        await runWithSiteRoot(root, async () => {
          const resolved = resolvePath(relPath);
          expect(resolved.startsWith(root)).toBe(true);
        });
      }),
      { numRuns: 50 }
    );
  });

  it("paths resolved for project A never start with the root of a different project B", async () => {
    await fc.assert(
      fc.asyncProperty(
        projectIdArb,
        projectIdArb,
        relativeFilePathArb,
        async (projectIdA, projectIdB, relPath) => {
          fc.pre(projectIdA !== projectIdB);
          const rootA = path.join(WORKSPACE_ROOT, "sites", projectIdA);
          const rootB = path.join(WORKSPACE_ROOT, "sites", projectIdB);
          await runWithSiteRoot(rootA, async () => {
            const resolved = resolvePath(relPath);
            expect(resolved.startsWith(rootB + path.sep) || resolved === rootB).toBe(false);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it("runWithSiteRoot rejects paths outside WORKSPACE_ROOT/sites/", () => {
    const badPaths = [
      WORKSPACE_ROOT,
      path.join(WORKSPACE_ROOT, "lib"),
      path.join(WORKSPACE_ROOT, "app"),
      "/tmp/evil",
      path.join(WORKSPACE_ROOT, "sites/../etc"),
    ];
    for (const badPath of badPaths) {
      expect(() => runWithSiteRoot(badPath, async () => "ok")).toThrow();
    }
  });

  it("runWithSiteRoot rejects sites/template explicitly", () => {
    const templatePath = path.join(WORKSPACE_ROOT, "sites", "template");
    expect(() => runWithSiteRoot(templatePath, async () => "ok")).toThrow(/sites\/template/);
  });

  it("setSiteRoot inside runWithSiteRoot mutates only the active context", async () => {
    const rootA = path.join(WORKSPACE_ROOT, "sites", "alpha-proj");
    const rootB = path.join(WORKSPACE_ROOT, "sites", "beta-proj");
    await runWithSiteRoot(rootA, async () => {
      expect(getSiteRoot()).toBe(rootA);
      // Sibling scope should not see this mutation.
      const sibling = runWithSiteRoot(rootB, async () => getSiteRoot());
      expect(await sibling).toBe(rootB);
      // Original scope still has its own value.
      expect(getSiteRoot()).toBe(rootA);
    });
    expect(tryGetSiteRoot()).toBeNull();
  });

  it("concurrent runWithSiteRoot scopes do not bleed into each other", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `concurrent-${i.toString(36)}-x`);
    const observed = await Promise.all(
      ids.map((id) =>
        runWithSiteRoot(path.join(WORKSPACE_ROOT, "sites", id), async () => {
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)));
          return getSiteRoot();
        })
      )
    );
    ids.forEach((id, i) => {
      expect(observed[i]).toBe(path.join(WORKSPACE_ROOT, "sites", id));
    });
  });
});
