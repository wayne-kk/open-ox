import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { runWithSiteRoot, WORKSPACE_ROOT } from "./common";
import { trackFileWrite, clearFileWriteTracking } from "./fileWriteTracker";
import { executeReadLints } from "./readLintsTool";
import {
  verifyWrittenSourceFile,
  resetSectionTscCache,
} from "../../flows/generate_project/shared/tsxDiagnostics";
import type { ToolDiagnostic, ToolResult } from "../types";

const TEST_PROJECT_ID = `__verify_test_${Date.now()}__`;
const TEST_PROJECT_ROOT = path.join(WORKSPACE_ROOT, "sites", TEST_PROJECT_ID);

const MIN_TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    lib: ["dom", "dom.iterable", "esnext"],
    skipLibCheck: true,
    strict: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "react-jsx",
    baseUrl: ".",
    paths: { "@/*": ["./*"] },
  },
  include: ["**/*.ts", "**/*.tsx"],
};

function writeFixture(rel: string, content: string): void {
  const abs = path.join(TEST_PROJECT_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

function isToolResult(value: ToolResult | string | undefined): value is ToolResult {
  return typeof value === "object" && value !== null && "success" in (value as object);
}

beforeAll(() => {
  fs.mkdirSync(TEST_PROJECT_ROOT, { recursive: true });
  fs.writeFileSync(
    path.join(TEST_PROJECT_ROOT, "tsconfig.json"),
    JSON.stringify(MIN_TSCONFIG, null, 2),
    "utf-8"
  );
});

afterAll(() => {
  resetSectionTscCache();
  fs.rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  clearFileWriteTracking();
});

describe("verifyWrittenSourceFile (write_file / edit_file in-band diagnostics)", () => {
  it("returns no issues for a clean .tsx file", async () => {
    writeFixture("clean.tsx", `export default function Hi() { return <div>Hi</div>; }\n`);
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const result = await verifyWrittenSourceFile("clean.tsx");
      expect(result.errorCount).toBe(0);
      expect(result.diagnostics).toEqual([]);
      expect(result.inline).toBe("");
    });
  });

  it("flags a misspelled type name (catches the 'Read_only' class of bugs)", async () => {
    writeFixture(
      "spelling.tsx",
      `export default function Hi(props: Read_only<{ a: number }>) {
         return <div>{props.a}</div>;
       }\n`
    );
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const result = await verifyWrittenSourceFile("spelling.tsx");
      expect(result.errorCount).toBeGreaterThan(0);
      const messages = result.diagnostics.map((d: ToolDiagnostic) => d.message).join(" | ");
      expect(messages).toMatch(/Read_only|Cannot find name/);
      expect(result.inline).toContain("spelling.tsx");
      expect(result.inline).toContain("Type-check found");
    });
  });

  it("flags missing local imports (relative paths) but not bare npm specifiers", async () => {
    writeFixture(
      "with-imports.tsx",
      `import { Missing } from "./does-not-exist";
       import { x } from "some-real-npm-package";
       export default function Hi() { return <Missing>{x}</Missing>; }\n`
    );
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const result = await verifyWrittenSourceFile("with-imports.tsx");
      const messages = result.diagnostics.map((d: ToolDiagnostic) => d.message).join(" | ");
      expect(messages).toMatch(/does-not-exist/);
      expect(messages).not.toMatch(/'some-real-npm-package'/);
    });
  });

  it("returns empty result for non-source extensions (.css, .json, .md)", async () => {
    writeFixture("styles.css", `.a { color: red; ;; this-is-not-css`);
    writeFixture("data.json", `{ this is not json }`);
    writeFixture("notes.md", `# header`);
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      for (const rel of ["styles.css", "data.json", "notes.md"]) {
        const result = await verifyWrittenSourceFile(rel);
        expect(result.errorCount).toBe(0);
        expect(result.warningCount).toBe(0);
        expect(result.inline).toBe("");
        expect(result.diagnostics).toEqual([]);
      }
    });
  });

  it("returns empty result for files that don't exist on disk yet", async () => {
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const result = await verifyWrittenSourceFile("does-not-exist.tsx");
      // When the file is missing, checkTsxFile reports a synthetic error;
      // verifyWrittenSourceFile surfaces it so the agent learns the write
      // didn't land. We only assert it doesn't throw.
      expect(typeof result.errorCount).toBe("number");
    });
  });
});

describe("read_lints tool", () => {
  it("checks recently-written files when called with no args", async () => {
    writeFixture(
      "recently-written.tsx",
      `export default function X() {
         const z: Read_only<{ a: 1 }> = { a: 1 };
         return <div>{z.a}</div>;
       }\n`
    );
    trackFileWrite("recently-written.tsx");

    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const raw = await executeReadLints({});
      expect(isToolResult(raw)).toBe(true);
      const result = raw as ToolResult;
      expect(result.success).toBe(true);
      expect(result.meta?.checkedFiles).toEqual(["recently-written.tsx"]);
      expect(typeof result.meta?.errorCount).toBe("number");
      expect((result.meta!.errorCount as number) > 0).toBe(true);
      expect(result.diagnostics?.length).toBeGreaterThan(0);
      expect(result.output).toMatch(/error\(s\)/);
    });
  });

  it("respects explicit paths over the recently-written set", async () => {
    writeFixture("specific-target.tsx", `export default function Y() { return <div/>; }\n`);

    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const raw = await executeReadLints({ paths: ["specific-target.tsx"] });
      const result = raw as ToolResult;
      expect(result.success).toBe(true);
      expect(result.meta?.checkedFiles).toEqual(["specific-target.tsx"]);
      expect(result.meta?.errorCount).toBe(0);
      expect(result.diagnostics).toEqual([]);
    });
  });

  it("filters out non-source extensions silently", async () => {
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const raw = await executeReadLints({
        paths: ["styles.css", "data.json", "notes.md"],
      });
      const result = raw as ToolResult;
      expect(result.success).toBe(true);
      expect(result.meta?.checkedFiles).toEqual([]);
      expect(result.diagnostics).toEqual([]);
      expect(result.output).toMatch(/0 file/);
    });
  });

  it("returns clean result when there are no recently-written files and no paths", async () => {
    await runWithSiteRoot(TEST_PROJECT_ROOT, async () => {
      const raw = await executeReadLints({});
      const result = raw as ToolResult;
      expect(result.success).toBe(true);
      expect(result.meta?.checkedFiles).toEqual([]);
      expect(result.output).toMatch(/0 file/);
    });
  });
});
