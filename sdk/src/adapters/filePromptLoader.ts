/**
 * File-based PromptLoader adapter.
 * Loads prompt templates from a directory on disk.
 */

import { readFile, access } from "fs/promises";
import { join } from "path";
import type { PromptLoader, PromptKind } from "../types";

/** Default prompt directory structure mirrors the ai/flows/generate_project/prompts layout */
const KIND_TO_DIR: Record<PromptKind, string> = {
  step: "steps",
  section: "sections",
  skill: "skills",
  guardrail: "rules",
  system: "systems",
  motion: "motions",
  layout: "layouts",
  capability: "capabilities",
  "modify-system": "modify-systems",
};

export class FilePromptLoader implements PromptLoader {
  private promptsDir: string;
  private cache = new Map<string, string>();

  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }

  async loadPrompt(kind: PromptKind, id: string): Promise<string> {
    const key = `${kind}:${id}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const dir = KIND_TO_DIR[kind] ?? kind;
    const filePath = join(this.promptsDir, dir, `${id}.md`);

    const content = await readFile(filePath, "utf-8");
    this.cache.set(key, content);
    return content;
  }

  async hasPrompt(kind: PromptKind, id: string): Promise<boolean> {
    const dir = KIND_TO_DIR[kind] ?? kind;
    const filePath = join(this.promptsDir, dir, `${id}.md`);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export function createFilePromptLoader(promptsDir: string): FilePromptLoader {
  return new FilePromptLoader(promptsDir);
}
