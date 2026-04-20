import { existsSync, readFileSync } from "fs";
import matter from "gray-matter";
import { resolvePromptPath, resolvePromptPathForProfile } from "./catalog";
import { getPromptProfile } from "./profile";
import type { PromptKind } from "./types";

const cache = new Map<string, string>();

function withFrontmatterStripped(kind: PromptKind, raw: string): string {
  if (kind === "guardrail") {
    return matter(raw).content.trimStart();
  }
  return raw;
}

export function loadPrompt(kind: PromptKind, id: string): string {
  const profile = getPromptProfile();
  const key = `${profile}:${kind}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fullPath = resolvePromptPath(kind, id);
  const fallbackPath =
    profile === "app" ? resolvePromptPathForProfile("web", kind, id) : null;
  const resolvedPath =
    existsSync(fullPath) ? fullPath : fallbackPath && existsSync(fallbackPath) ? fallbackPath : fullPath;
  if (!existsSync(resolvedPath)) {
    throw new Error(`Prompt not found: ${resolvedPath}`);
  }
  const raw = readFileSync(resolvedPath, "utf-8");
  const content = withFrontmatterStripped(kind, raw);
  cache.set(key, content);
  return content;
}

export function hasPrompt(kind: PromptKind, id: string): boolean {
  return existsSync(resolvePromptPath(kind, id));
}
