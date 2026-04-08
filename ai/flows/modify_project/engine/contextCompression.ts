import type { ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import type { LoopState } from "./stopHooks";

const CONTEXT_COMPRESS_THRESHOLD = 50_000;
const KEEP_RECENT_MESSAGES = 10;

export function compressContext(messages: ChatMessage[], loopState?: LoopState): void {
  const totalChars = messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + content.length;
  }, 0);

  if (totalChars < CONTEXT_COMPRESS_THRESHOLD) return;

  const hotFiles = new Set<string>();
  if (loopState) {
    for (const [file, count] of loopState.fileEditCounts) {
      if (count > 0) hotFiles.add(file);
    }
    if (loopState.lastOperatedFile) hotFiles.add(loopState.lastOperatedFile);
  }

  const compressibleEnd = Math.max(2, messages.length - KEEP_RECENT_MESSAGES);
  for (let i = 1; i < compressibleEnd; i++) {
    const msg = messages[i];
    if (msg.role !== "tool" || typeof msg.content !== "string" || msg.content.length <= 300) continue;

    const content = msg.content as string;
    const mentionsHotFile = Array.from(hotFiles).some((f) => content.includes(f));
    if (mentionsHotFile) continue;

    const head = content.slice(0, 150);
    const tail = content.slice(-50);
    messages[i] = {
      ...msg,
      content: `${head}\n...[compressed: ${content.length} chars, not relevant to current edits]...\n${tail}`,
    };
  }
}
