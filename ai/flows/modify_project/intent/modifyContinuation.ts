import type { ModifyHistoryTurn } from "../history/modifyHistoryTurn";
import type { ModifyIntentCategory } from "./modifyIntentRouter";

export type { ModifyHistoryTurn };

const META_GREETING_RE =
  /^(你好|您好|hi|hello|嗨|在吗|谢谢|感谢|多谢|help|\/help|\/clear|\/memory)$/i;

const CASUAL_PRAISE_RE =
  /^(?:(?:谢谢|感谢|多谢)(?:你|您)?[，,\s]*)?(?:(?:非常|真的?|太|挺|很)?(?:不错|棒|厉害|优秀|完美|赞)|(?:你|您)(?:很|真|太|非常)?棒|做得(?:很|真|非常)?好|干得漂亮|great job|well done|awesome)(?:[，,\s]+(?:(?:非常|真的?|太|挺|很)?(?:不错|棒|厉害|优秀|完美|赞)|(?:你|您)(?:很|真|太|非常)?棒|做得(?:很|真|非常)?好|干得漂亮|great job|well done|awesome))?[！!。.\s]*$/i;

const AFFIRMATIVE_REPLY_RE =
  /^(是的|好的|好|对|嗯|行|可以|确认|按这个|就这个|ok|okay|yes|yep|sure|第一个|第二个|第三个|第[一二三四五1-5个]+|[A-Da-d][选项]?)$/i;

function isShortContinuationReply(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length <= 24) return true;
  return /^\d+(\.\d+)?(%|x|px|ms|s|秒|倍|倍速)?$/i.test(trimmed);
}

export function isMetaGreetingOnly(text: string): boolean {
  const trimmed = text.trim();
  return META_GREETING_RE.test(trimmed) || CASUAL_PRAISE_RE.test(trimmed);
}

export function detectContinuationReply(
  userInstruction: string,
  recentHistory: ModifyHistoryTurn[]
): boolean {
  const trimmed = userInstruction.trim();
  if (!trimmed || recentHistory.length === 0) return false;
  if (isMetaGreetingOnly(trimmed)) return false;

  const last = recentHistory[recentHistory.length - 1];
  if (!last.awaitingReply) return false;

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
  const assistantReply = last.assistantText.trim();

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

  const blob = `${last.instruction}\n${last.assistantText}`.toLowerCase();
  if (/确认执行|按这个计划|planned target/i.test(last.assistantText)) {
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

  return next;
}
