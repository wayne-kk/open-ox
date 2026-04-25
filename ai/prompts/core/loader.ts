import { existsSync, readFileSync } from "fs";
import matter from "gray-matter";
import { resolvePromptPath } from "./catalog";
import type { PromptKind } from "./types";

const cache = new Map<string, string>();

function withFrontmatterStripped(kind: PromptKind, raw: string): string {
  if (kind === "guardrail") {
    return matter(raw).content.trimStart();
  }
  return raw;
}

export function loadPrompt(kind: PromptKind, id: string): string {
  const key = `${kind}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fullPath = resolvePromptPath(kind, id);
  if (!existsSync(fullPath)) {
    throw new Error(`Prompt not found: ${fullPath}`);
  }
  const raw = readFileSync(fullPath, "utf-8");
  const content = withFrontmatterStripped(kind, raw);
  cache.set(key, content);
  return content;
}

export function hasPrompt(kind: PromptKind, id: string): boolean {
  return existsSync(resolvePromptPath(kind, id));
}
