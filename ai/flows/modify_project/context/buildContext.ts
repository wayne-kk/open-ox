import fs from "fs/promises";
import path from "path";
import type { ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import type { ModifyIntentCategory } from "../intent/modifyIntentRouter";
import { READ_ONLY_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../prompt/systemPrompt";

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

function userMessageFooter(category: ModifyIntentCategory): string {
  if (category === "read_only") {
    return `Use read_file / search_code / list_dir to answer. Do NOT edit files. When done researching, respond with a complete answer in the user's language.`;
  }
  return `Use edit_file for surgical changes. Do not call run_build — scoped typecheck runs when you finish. Call run_scoped_tsc if you touched many TS/TSX files.`;
}

export function buildInitialMessages(params: {
  modifyCategory: ModifyIntentCategory;
  userInstruction: string;
  historyContext: string;
  fileTree: string;
  designSystem: string;
  globalsCss: string;
  imageBase64?: string;
  preloadedFiles?: Array<{ path: string; content: string }>;
  planSummary?: string;
}): ChatMessage[] {
  const systemPrompt =
    params.modifyCategory === "read_only" ? READ_ONLY_SYSTEM_PROMPT : SYSTEM_PROMPT;

  const preloadBlock =
    params.preloadedFiles && params.preloadedFiles.length > 0
      ? `\n## Preloaded files (from intent router — prefer these paths)\n${params.preloadedFiles
          .map(
            (f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
          )
          .join("\n\n")}\n`
      : "";

  const planBlock = params.planSummary?.trim()
    ? `\n## Approved plan (broad change)\n${params.planSummary.trim()}\n`
    : "";

  const scopeNote =
    params.modifyCategory === "read_only"
      ? "⚠️ MODE: Read-only Q&A — explain and answer; do not modify files.\n"
      : "⚠️ SCOPE: Only modify files directly related to the instruction above. Do not change unrelated sections.\n";

  const userMessage = `## User Instruction
${params.userInstruction}
${params.historyContext}
${scopeNote}${params.imageBase64 ? "⚠️ IMAGE: Use the image only to identify the specific element mentioned in the instruction. Do not fix other things you see in the image.\n" : ""}
## Project File Tree
\`\`\`
${params.fileTree}
\`\`\`
${preloadBlock}${planBlock}
## Design System
${params.designSystem.slice(0, 2000)}

## Current globals.css (first 1000 chars)
\`\`\`css
${params.globalsCss.slice(0, 1000)}
\`\`\`

${userMessageFooter(params.modifyCategory)}`;

  return [
    { role: "system", content: systemPrompt },
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
