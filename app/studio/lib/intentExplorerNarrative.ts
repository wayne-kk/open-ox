import type { IntentProgressEvent } from "@/ai/flows/generate_project/intentAgent/types";

function escapeMarkdownInline(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "'").replace(/\*/g, "·").replace(/\[/g, "(").replace(/\]/g, ")");
}

/** Cursor-style explorer copy: prose + backticked identifiers (Markdown). */
export function buildIntentExplorerMarkdown(
  events: IntentProgressEvent[],
  mode: "live" | "archived"
): string {
  if (!events.length) {
    return "等待 `intent_progress` 事件…";
  }

  const maxIter = Math.max(...events.map((e) => e.iteration), -1);
  const roundCount = maxIter >= 0 ? maxIter + 1 : 0;
  const toolEvents = events.filter((e): e is Extract<IntentProgressEvent, { kind: "tool" }> => e.kind === "tool");
  const toolNamesFinished = [...new Set(toolEvents.map((e) => e.toolName).filter(Boolean))];

  const last = events[events.length - 1]!;

  let stepNow = "";
  if (last.kind === "assistant_round") {
    const planned =
      last.toolCallNames?.filter(Boolean).map((n) => `\`${n}\``).join(" → ") ||
      "`（本步无 tool_calls — 模型可能直接输出文本）`";
    stepNow = `当前处于第 **${last.iteration + 1}** 轮编排（\`assistant_round\`），模型计划：` + planned + `。`;
  } else if (last.kind === "tool") {
    stepNow =
      `刚执行完工具 \`${last.toolName}\`（\`iteration\`=${last.iteration + 1}），` +
      `等待下一轮 \`assistant_round\` 消费返回结果。`;
  } else {
    const snippet = escapeMarkdownInline(last.text.trim()).replace(/\s+/g, " ");
    const cut = snippet.length > 260 ? `${snippet.slice(0, 260)}…` : snippet;
    stepNow =
      `模型在 \`reasoning\` / thinking 通道推进（第 **${last.iteration + 1}** 轮）：` +
      (cut ? `「${cut}」` : "（空）");
  }

  const toolsLine =
    toolNamesFinished.length > 0
      ? `已在本次回合中跑过：` + toolNamesFinished.map((n) => `\`${n}\``).join("、") + `。`
      : "尚未记录已完成的工具回调（可能仍在纯推理或即将首次调用工具）。";

  const tail =
    mode === "live"
      ? "前端用 `intentLiveTrace` 累积上述事件；对用户可见的 **摘要**（`yield_to_user` 文案）会在本块之后单独展示。若随后进入生成队列，则会离开意图阶段并衔接后台 `runBuildSite` / `generation_queued` 流程。"
      : "以上为当时回合的探究轨迹归档，可在下方「技术明细」中查看参数与返回摘要。";

  const intro =
    mode === "live"
      ? `Studio 正在消费 **意图 Agent** 的 SSE 流：事件类型为 \`intent_progress\`，已写入 **${events.length}** 条记录，至少 **${roundCount}** 轮迭代。`
      : `该助手回合的 **探究轨迹**（\`intent_progress\` 归档）：共 **${events.length}** 条事件、**${roundCount}** 轮迭代。`;

  return [intro, toolsLine, stepNow, tail].join("\n\n");
}
