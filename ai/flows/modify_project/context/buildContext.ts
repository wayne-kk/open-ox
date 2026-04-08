import fs from "fs/promises";
import path from "path";
import type { ChatMessage } from "@/ai/flows/generate_project/shared/llm";

export async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function buildFileTree(dir: string): Promise<string> {
  const r: string[] = [];
  async function walk(d: string, p: string) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git"].includes(e.name)) continue;
      const rel = p ? `${p}/${e.name}` : e.name;
      if (e.isDirectory()) {
        r.push(`${rel}/`);
        await walk(path.join(d, e.name), rel);
      } else r.push(rel);
    }
  }
  await walk(dir, "");
  return r.join("\n");
}

export function buildHistoryContext(
  dbHistory: Array<{ instruction: string; summary: string }>,
  sessionHistory: Array<{ instruction: string; summary: string }>
): string {
  const seenInstructions = new Set(dbHistory.map((h) => h.instruction));
  const mergedHistory = [
    ...dbHistory,
    ...sessionHistory.filter((h) => !seenInstructions.has(h.instruction)),
  ];
  const MAX_HISTORY_TURNS = 10;
  const recentHistory = mergedHistory.slice(-MAX_HISTORY_TURNS);
  return recentHistory.length > 0
    ? `\n## Previous Modifications (conversation memory)\n${recentHistory
      .map((h, i) => `${i + 1}. User: "${h.instruction}"\n   Result: ${h.summary}`)
      .join("\n")}\n`
    : "";
}

export function buildInitialMessages(params: {
  systemPrompt: string;
  userInstruction: string;
  historyContext: string;
  fileTree: string;
  designSystem: string;
  globalsCss: string;
  imageBase64?: string;
}): ChatMessage[] {
  const userMessage = `## User Instruction
${params.userInstruction}
${params.historyContext}
⚠️ SCOPE: Only modify files directly related to the instruction above. Do not change other sections or files.
${params.imageBase64 ? "⚠️ IMAGE: Use the image only to identify the specific element mentioned in the instruction. Do not fix other things you see in the image.\n" : ""}
## Project File Tree
\`\`\`
${params.fileTree}
\`\`\`

## Design System
${params.designSystem.slice(0, 2000)}

## Current globals.css (first 1000 chars)
\`\`\`css
${params.globalsCss.slice(0, 1000)}
\`\`\`

Please read the relevant files, make ONLY the requested changes, and verify with run_build.`;

  return [
    { role: "system", content: params.systemPrompt },
    {
      role: "user",
      content: params.imageBase64
        ? [
          {
            type: "image_url" as const,
            image_url: {
              url: params.imageBase64.startsWith("data:")
                ? params.imageBase64
                : `data:image/png;base64,${params.imageBase64}`,
              detail: "high" as const,
            },
          },
          { type: "text" as const, text: userMessage },
        ]
        : userMessage,
    },
  ];
}
