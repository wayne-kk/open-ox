/**
 * Unit tests for SDK adapters
 *
 * Tests the Node.js adapter implementations against the interface contracts.
 */

import { describe, it, expect, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { NodeFileSystem } from "../adapters/nodeFs";
import { NodeShellExecutor } from "../adapters/nodeShell";
import { FilePromptLoader } from "../adapters/filePromptLoader";

const TEST_DIR = join(process.cwd(), ".sdk-test-tmp");

function ensureCleanDir(dir: string) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
}

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

// ─── NodeFileSystem ──────────────────────────────────────────────────────────

describe("NodeFileSystem", () => {
  const fs = new NodeFileSystem();

  it("writeFile creates parent directories and writes content", async () => {
    ensureCleanDir(TEST_DIR);
    const filePath = join(TEST_DIR, "sub/dir/test.txt");
    await fs.writeFile(filePath, "hello world");
    const content = await fs.readFile(filePath);
    expect(content).toBe("hello world");
  });

  it("exists returns true for existing file", async () => {
    ensureCleanDir(TEST_DIR);
    const filePath = join(TEST_DIR, "exists.txt");
    writeFileSync(filePath, "yes");
    expect(await fs.exists(filePath)).toBe(true);
  });

  it("exists returns false for missing file", async () => {
    expect(await fs.exists(join(TEST_DIR, "nope.txt"))).toBe(false);
  });

  it("readdir lists files", async () => {
    ensureCleanDir(TEST_DIR);
    writeFileSync(join(TEST_DIR, "a.txt"), "a");
    writeFileSync(join(TEST_DIR, "b.txt"), "b");
    const files = await fs.readdir(TEST_DIR);
    expect(files.sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("unlink removes a file", async () => {
    ensureCleanDir(TEST_DIR);
    const filePath = join(TEST_DIR, "delete-me.txt");
    writeFileSync(filePath, "bye");
    await fs.unlink(filePath);
    expect(await fs.exists(filePath)).toBe(false);
  });

  it("tryReadFile returns null for missing file", async () => {
    const content = await fs.tryReadFile(join(TEST_DIR, "missing.txt"));
    expect(content).toBeNull();
  });

  it("readFile throws for missing file", async () => {
    await expect(fs.readFile(join(TEST_DIR, "missing.txt"))).rejects.toThrow();
  });
});

// ─── NodeShellExecutor ───────────────────────────────────────────────────────

describe("NodeShellExecutor", () => {
  const shell = new NodeShellExecutor();

  it("executes a simple command", async () => {
    const result = await shell.exec("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("returns non-zero exit code for failing command", async () => {
    const result = await shell.exec("exit 1");
    expect(result.exitCode).not.toBe(0);
  });

  it("respects cwd option", async () => {
    ensureCleanDir(TEST_DIR);
    const result = await shell.exec("pwd", { cwd: TEST_DIR });
    expect(result.stdout.trim()).toContain(".sdk-test-tmp");
  });

  it("respects timeout option", async () => {
    const result = await shell.exec("sleep 10", { timeout: 500 });
    // Should fail due to timeout
    expect(result.exitCode).not.toBe(0);
  });
});

// ─── FilePromptLoader ────────────────────────────────────────────────────────

describe("FilePromptLoader", () => {
  it("loads a prompt file", async () => {
    ensureCleanDir(TEST_DIR);
    mkdirSync(join(TEST_DIR, "steps"), { recursive: true });
    writeFileSync(join(TEST_DIR, "steps/testStep.md"), "You are a helpful assistant.");

    const loader = new FilePromptLoader(TEST_DIR);
    const content = await loader.loadPrompt("step", "testStep");
    expect(content).toBe("You are a helpful assistant.");
  });

  it("caches loaded prompts", async () => {
    ensureCleanDir(TEST_DIR);
    mkdirSync(join(TEST_DIR, "steps"), { recursive: true });
    writeFileSync(join(TEST_DIR, "steps/cached.md"), "cached content");

    const loader = new FilePromptLoader(TEST_DIR);
    const first = await loader.loadPrompt("step", "cached");
    const second = await loader.loadPrompt("step", "cached");
    expect(first).toBe(second);
  });

  it("hasPrompt returns true for existing prompt", async () => {
    ensureCleanDir(TEST_DIR);
    mkdirSync(join(TEST_DIR, "rules"), { recursive: true });
    writeFileSync(join(TEST_DIR, "rules/outputJson.md"), "Return JSON only.");

    const loader = new FilePromptLoader(TEST_DIR);
    expect(await loader.hasPrompt("guardrail", "outputJson")).toBe(true);
  });

  it("hasPrompt returns false for missing prompt", async () => {
    ensureCleanDir(TEST_DIR);
    const loader = new FilePromptLoader(TEST_DIR);
    expect(await loader.hasPrompt("step", "nonexistent")).toBe(false);
  });

  it("throws for missing prompt file", async () => {
    ensureCleanDir(TEST_DIR);
    const loader = new FilePromptLoader(TEST_DIR);
    await expect(loader.loadPrompt("step", "missing")).rejects.toThrow();
  });
});
