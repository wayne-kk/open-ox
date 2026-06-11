import type { ChatMessage } from "@/ai/shared/llm/types";
import { plainTextFromUserMessageContent } from "../shared/userVisionContent";

/** Bootstrap + user turns + yield drafts — used by extract_user_provided_content for image URL scan. */
export function collectIntentAgentImageSourceTexts(params: {
  bootstrapUserPrompt?: string | null;
  messages: ChatMessage[];
}): string[] {
  const out: string[] = [];
  const boot = params.bootstrapUserPrompt?.trim();
  if (boot) out.push(boot);

  for (const m of params.messages) {
    if (m.role === "user") {
      const plain = plainTextFromUserMessageContent(m.content);
      if (plain.trim()) out.push(plain);
      continue;
    }
    if (m.role !== "assistant") continue;

    const raw = (m.tool_calls ?? []) as Array<{
      function?: { name?: string; arguments?: string };
    }>;
    for (const tc of raw) {
      if (tc.function?.name !== "yield_to_user") continue;
      try {
        const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
        const draft =
          typeof args.brief_draft_markdown === "string"
            ? args.brief_draft_markdown.trim()
            : "";
        if (draft) out.push(draft);
      } catch {
        /* ignore malformed tool args */
      }
    }
  }

  return out;
}
