import type { ModifyIntentCategory } from "./modifyIntentRouter";

export type ModifyHistoryTurn = {
  instruction: string;
  summary: string;
  intentCategory?: ModifyIntentCategory;
};

const META_GREETING_RE =
  /^(你好|您好|hi|hello|嗨|在吗|谢谢|感谢|多谢|help|\/help|\/clear|\/memory)$/i;

const AFFIRMATIVE_REPLY_RE =
  /^(是的|好的|好|对|嗯|行|可以|确认|按这个|就这个|ok|okay|yes|yep|sure|第一个|第二个|第三个|第[一二三四五1-5个]+|[A-Da-d][选项]?)$/i;

export function mergeModifyHistoryTurns(
  dbHistory: ModifyHistoryTurn[],
  sessionHistory: ModifyHistoryTurn[]
): ModifyHistoryTurn[] {
  const seenInstructions = new Set(dbHistory.map((h) => h.instruction));
  return [
    ...dbHistory,
    ...sessionHistory.filter((h) => !seenInstructions.has(h.instruction)),
  ];
}

export function isMetaGreetingOnly(text: string): boolean {
  return META_GREETING_RE.test(text.trim());
}

function isShortContinuationReply(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length <= 24) return true;
  return /^\d+(\.\d+)?(%|x|px|ms|s|秒|倍|倍速)?$/i.test(trimmed);
}

function stripSummaryFilesSuffix(summary: string): string {
  return summary.replace(/\s*Files:.*$/s, "").trim();
}

/** True when the prior assistant turn likely expects a follow-up from the user. */
export function lastTurnAwaitingReply(summary: string): boolean {
  const body = stripSummaryFilesSuffix(summary);
  if (!body) return false;

  if (/[?？]/.test(body)) return true;

  if (
    /请(你|告|说|确认|补充|选择)|需要你|能否|是否可以|要不要|哪个|哪种|多少|哪一种|哪一项/.test(
      body
    )
  ) {
    return true;
  }

  if (/Files:\s*$/m.test(summary)) return true;
  if (/Modified 0 file\(s\)|made no changes|but made no changes|未修改|0 file\(s\)/i.test(summary)) {
    return true;
  }

  if (/确认执行|按这个计划修改|Planned target — not executed/i.test(body)) return true;

  return false;
}

export function detectContinuationReply(
  userInstruction: string,
  recentHistory: ModifyHistoryTurn[]
): boolean {
  const trimmed = userInstruction.trim();
  if (!trimmed || recentHistory.length === 0) return false;
  if (isMetaGreetingOnly(trimmed)) return false;

  const last = recentHistory[recentHistory.length - 1];
  if (!lastTurnAwaitingReply(last.summary)) return false;

  if (isShortContinuationReply(trimmed)) return true;
  if (AFFIRMATIVE_REPLY_RE.test(trimmed)) return true;

  return false;
}

export function mergeContinuationInstruction(
  userInstruction: string,
  recentHistory: ModifyHistoryTurn[]
): string {
  const last = recentHistory[recentHistory.length - 1];
  const priorInstruction = last.instruction.trim();
  const assistantReply = stripSummaryFilesSuffix(last.summary);

  return [
    "（续答上一轮对话）",
    `用户最初请求：${priorInstruction}`,
    assistantReply ? `助手上一轮回复：${assistantReply}` : null,
    `用户本轮补充：${userInstruction.trim()}`,
    "请基于以上上下文继续处理，不要重复欢迎语或把本轮输入当成全新会话。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function inferContinuationCategory(
  recentHistory: ModifyHistoryTurn[]
): ModifyIntentCategory {
  const last = recentHistory[recentHistory.length - 1];
  if (last.intentCategory && last.intentCategory !== "conversation") {
    return last.intentCategory;
  }

  const blob = `${last.instruction}\n${last.summary}`.toLowerCase();
  if (/确认执行|按这个计划|planned target/i.test(last.summary)) {
    return "code_change";
  }
  if (/列个计划|改造计划|refactor 步骤|先别改|plan_only|规划/.test(blob)) {
    return "plan_only";
  }
  if (/在哪|怎么实现|解释一下|有哪些|walk-through|explain|read_only|问答/.test(blob)) {
    return "read_only";
  }
  return "code_change";
}

/** Block onboarding-style conversation replies when modify history exists. */
export function shouldBlockConversationShortCircuit(
  userInstruction: string,
  recentHistory: ModifyHistoryTurn[]
): boolean {
  if (recentHistory.length === 0) return false;
  if (isMetaGreetingOnly(userInstruction)) return false;
  return true;
}

export function applyContinuationRoutingOverrides(
  routed: {
    category: ModifyIntentCategory;
    scope: "style" | "narrow" | "broad";
    preloadPaths: string[];
    assistantMessage: string;
  },
  options: {
    isContinuation: boolean;
    recentHistory: ModifyHistoryTurn[];
    originalInstruction: string;
  }
): typeof routed {
  let next = routed;

  if (options.isContinuation) {
    const forcedCategory = inferContinuationCategory(options.recentHistory);
    if (next.category === "conversation" || next.category !== forcedCategory) {
      next = {
        ...next,
        category: forcedCategory,
        assistantMessage: "",
      };
    }
    return next;
  }

  if (
    next.category === "conversation" &&
    shouldBlockConversationShortCircuit(options.originalInstruction, options.recentHistory)
  ) {
    next = {
      ...next,
      category: inferContinuationCategory(options.recentHistory),
      assistantMessage: "",
    };
  }

  return next;
}

export function formatRecentHistoryForRouter(turns: ModifyHistoryTurn[]): string {
  if (turns.length === 0) return "";
  return `\n\n## Recent modify conversation (oldest first — use for follow-up replies)\n${turns
    .map(
      (h, i) =>
        `${i + 1}. User: "${h.instruction}"\n   Assistant: ${stripSummaryFilesSuffix(h.summary).slice(0, 600)}`
    )
    .join("\n")}\n`;
}
