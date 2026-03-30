// Feature: multi-project-workspace, Property 2: Generated files land in the correct project directory
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import path from "path";
import { WORKSPACE_ROOT, getSiteRoot, setSiteRoot, resolvePath } from "./common";

/**
 * Validates: Requirements 1.2
 *
 * Property 2: Generated files land in the correct project directory.
 * For any project ID, all files written by Generate_Flow must have paths that
 * begin with `sites/{project-id}/` and must not exist under any other project's
 * directory.
 *
 * We test this by verifying that:
 * 1. setSiteRoot(getSiteRoot(projectId)) correctly sets the root to WORKSPACE_ROOT/sites/{projectId}
 * 2. resolvePath() always produces paths under the current SITE_ROOT
 * 3. Paths for project A never start with the root of project B
 */

// Arbitrary for valid project IDs (alphanumeric + hyphens, no path traversal)
const projectIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9\-_]{0,50}[a-z0-9]$/).filter(
    (s) => !s.includes("..") && s.length >= 2
);

// Arbitrary for relative file paths (no traversal)
const relativeFilePathArb = fc
    .array(fc.stringMatching(/^[a-z0-9_\-]+(\.[a-z]{1,5})?$/), { minLength: 1, maxLength: 4 })
    .map((parts) => parts.join("/"))
    .filter((p) => p.length > 0);

describe("Property 2: Generated files land in the correct project directory", () => {
    // Reset SITE_ROOT after each test to avoid cross-test pollution
    const originalSiteRoot = getSiteRoot();
    beforeEach(() => {
        setSiteRoot(path.join(WORKSPACE_ROOT, "sites", "template"));
    });

    it("setSiteRoot sets the root to WORKSPACE_ROOT/sites/{projectId} for any valid project ID", () => {
        fc.assert(
            fc.property(projectIdArb, (projectId) => {
                const expectedRoot = path.join(WORKSPACE_ROOT, "sites", projectId);
                setSiteRoot(expectedRoot);
                expect(getSiteRoot()).toBe(expectedRoot);
                expect(getSiteRoot().startsWith(path.join(WORKSPACE_ROOT, "sites") + path.sep)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it("resolvePath always produces paths under the current SITE_ROOT for any relative path", () => {
        fc.assert(
            fc.property(projectIdArb, relativeFilePathArb, (projectId, relPath) => {
                const root = path.join(WORKSPACE_ROOT, "sites", projectId);
                setSiteRoot(root);
                const resolved = resolvePath(relPath);
                expect(resolved.startsWith(root)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it("files resolved for project A never start with the root of a different project B", () => {
        fc.assert(
            fc.property(
                projectIdArb,
                projectIdArb,
                relativeFilePathArb,
                (projectIdA, projectIdB, relPath) => {
                    fc.pre(projectIdA !== projectIdB);
                    const rootA = path.join(WORKSPACE_ROOT, "sites", projectIdA);
                    const rootB = path.join(WORKSPACE_ROOT, "sites", projectIdB);
                    setSiteRoot(rootA);
                    const resolved = resolvePath(relPath);
                    // File resolved under project A must not be under project B's root
                    expect(resolved.startsWith(rootB + path.sep) || resolved === rootB).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("setSiteRoot throws for paths outside WORKSPACE_ROOT/sites/", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant(WORKSPACE_ROOT),
                    fc.constant(path.join(WORKSPACE_ROOT, "lib")),
                    fc.constant(path.join(WORKSPACE_ROOT, "app")),
                    fc.constant("/tmp/evil"),
                    fc.constant(path.join(WORKSPACE_ROOT, "sites/../etc"))
                ),
                (badPath) => {
                    expect(() => setSiteRoot(badPath)).toThrow();
                }
            ),
            { numRuns: 20 }
        );
    });

    it("getSiteRoot() reflects the current dynamic value after setSiteRoot", () => {
        fc.assert(
            fc.property(projectIdArb, (projectId) => {
                const root = path.join(WORKSPACE_ROOT, "sites", projectId);
                setSiteRoot(root);
                // getSiteRoot() must always return the latest value set by setSiteRoot
                expect(getSiteRoot()).toBe(root);
            }),
            { numRuns: 50 }
        );
    });
});
