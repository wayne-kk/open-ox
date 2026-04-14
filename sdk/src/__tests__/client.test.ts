/**
 * Unit tests for OpenOxClient
 *
 * These tests verify the SDK's public API surface using mocked adapters.
 * No real LLM calls or file system access.
 */

import { describe, it, expect, vi } from "vitest";
import { OpenOxClient } from "../client";
import type { FileSystem, ShellExecutor } from "../types";

// ─── Mock Adapters ───────────────────────────────────────────────────────────

function createMockFileSystem(): FileSystem {
  const store = new Map<string, string>();
  return {
    readFile: vi.fn(async (path: string) => {
      const content = store.get(path);
      if (!content) throw new Error(`ENOENT: ${path}`);
      return content;
    }),
    writeFile: vi.fn(async (path: string, content: string) => {
      store.set(path, content);
    }),
    exists: vi.fn(async (path: string) => store.has(path)),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async (path: string) => {
      const prefix = path.endsWith("/") ? path : path + "/";
      return Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length).split("/")[0])
        .filter((v, i, a) => a.indexOf(v) === i);
    }),
    unlink: vi.fn(async (path: string) => {
      store.delete(path);
    }),
    tryReadFile: vi.fn(async (path: string) => store.get(path) ?? null),
  };
}

function createMockShellExecutor(): ShellExecutor {
  return {
    exec: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OpenOxClient", () => {
  describe("constructor validation", () => {
    it("throws if apiKey is missing", () => {
      expect(
        () =>
          new OpenOxClient({
            llm: { apiKey: "" },
            projectsRoot: "./projects",
          })
      ).toThrow("llm.apiKey is required");
    });

    it("throws if projectsRoot is missing", () => {
      expect(
        () =>
          new OpenOxClient({
            llm: { apiKey: "sk-test" },
            projectsRoot: "",
          })
      ).toThrow("projectsRoot is required");
    });

    it("creates client with valid config", () => {
      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./projects",
        fileSystem: createMockFileSystem(),
        shellExecutor: createMockShellExecutor(),
      });
      expect(client).toBeDefined();
    });
  });

  describe("getProjectPath", () => {
    it("returns correct path", () => {
      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./generated-projects",
      });
      expect(client.getProjectPath("abc123")).toBe("./generated-projects/abc123");
    });
  });

  describe("listProjectFiles", () => {
    it("returns empty array if project does not exist", async () => {
      const fs = createMockFileSystem();
      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./projects",
        fileSystem: fs,
      });
      const files = await client.listProjectFiles("nonexistent");
      expect(files).toEqual([]);
    });

    it("throws if fileSystem is not provided", async () => {
      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./projects",
      });
      await expect(client.listProjectFiles("test")).rejects.toThrow("fileSystem adapter required");
    });
  });

  describe("readProjectFile", () => {
    it("reads file through fileSystem adapter", async () => {
      const fs = createMockFileSystem();
      await fs.writeFile("./projects/proj1/index.tsx", "export default function Home() {}");

      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./projects",
        fileSystem: fs,
      });

      const content = await client.readProjectFile("proj1", "index.tsx");
      expect(content).toBe("export default function Home() {}");
    });

    it("throws for missing file", async () => {
      const fs = createMockFileSystem();
      const client = new OpenOxClient({
        llm: { apiKey: "sk-test" },
        projectsRoot: "./projects",
        fileSystem: fs,
      });
      await expect(client.readProjectFile("proj1", "missing.tsx")).rejects.toThrow("ENOENT");
    });
  });
});
