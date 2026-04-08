import type { PromptComposeInput } from "./types";

function normalizeBlock(block: string): string {
  return block.trim().replace(/\s+/g, " ");
}

export function composePrompt(input: PromptComposeInput): string {
  const dedupe = input.dedupe ?? true;
  if (!dedupe) {
    return input.blocks.filter(Boolean).join("\n\n");
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const block of input.blocks) {
    if (!block?.trim()) continue;
    const key = normalizeBlock(block);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
  }
  return unique.join("\n\n");
}
