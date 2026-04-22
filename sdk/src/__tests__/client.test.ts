/**
 * Unit tests for OpenOxClient
 *
 * Validates config, path helpers, and filesystem helpers without calling the LLM.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { OpenOxClient } from "../client";

describe("OpenOxClient", () => {
  describe("constructor validation", () => {
    it("throws if apiKey is missing", () => {
      expect(
        () =>
          new OpenOxClient({
            apiKey: "",
            outputDir: "./projects",
          })
      ).toThrow("OpenOxClient: apiKey is required");
    });

    it("throws if outputDir is missing", () => {
      expect(
        () =>
          new OpenOxClient({
            apiKey: "sk-test",
            outputDir: "",
          })
      ).toThrow("OpenOxClient: outputDir is required");
    });

    it("creates client with valid config", () => {
      const client = new OpenOxClient({
        apiKey: "sk-test",
        outputDir: "./projects",
      });
      expect(client).toBeDefined();
    });
  });

  describe("getProjectPath", () => {
    it("returns correct path", () => {
      const client = new OpenOxClient({
        apiKey: "sk-test",
        outputDir: "./generated-projects",
      });
      expect(client.getProjectPath("abc123")).toBe("./generated-projects/abc123");
    });
  });

  describe("listProjectFiles", () => {
    it("returns empty array if project does not exist", async () => {
      const dir = mkdtempSync(join(tmpdir(), "ox-sdk-list-"));
      try {
        const client = new OpenOxClient({
          apiKey: "sk-test",
          outputDir: dir,
        });
        const files = await client.listProjectFiles("nonexistent");
        expect(files).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("readProjectFile", () => {
    it("reads file from project directory", async () => {
      const dir = mkdtempSync(join(tmpdir(), "ox-sdk-read-"));
      try {
        mkdirSync(join(dir, "proj1"), { recursive: true });
        writeFileSync(join(dir, "proj1", "index.tsx"), "export default function Home() {}");

        const client = new OpenOxClient({
          apiKey: "sk-test",
          outputDir: dir,
        });

        const content = await client.readProjectFile("proj1", "index.tsx");
        expect(content).toBe("export default function Home() {}");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("throws for missing file", async () => {
      const dir = mkdtempSync(join(tmpdir(), "ox-sdk-read-miss-"));
      try {
        mkdirSync(join(dir, "proj1"), { recursive: true });

        const client = new OpenOxClient({
          apiKey: "sk-test",
          outputDir: dir,
        });
        await expect(client.readProjectFile("proj1", "missing.tsx")).rejects.toMatchObject({
          code: "ENOENT",
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
