"use client";

import type { BoardRun } from "@/lib/modify/boardRun/boardRunTypes";

type Props = {
  boardRun: BoardRun;
  draining?: boolean;
  onPause?: () => void;
  onContinue?: () => void;
  onCancelRemaining?: () => void;
  onRetry?: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  busy?: boolean;
};

export function BoardProgressPin({
  boardRun,
  draining,
  onPause,
  onContinue,
  onCancelRemaining,
  onRetry,
  onSkip,
  busy,
}: Props) {
  const done = boardRun.tasks.filter((t) => t.status === "done" || t.status === "skipped").length;
  const total = boardRun.tasks.length;
  const inFlight = boardRun.tasks.find((t) => t.status === "in_flight");
  const failed = boardRun.tasks.find((t) => t.status === "failed");

  if (boardRun.status === "proposed") return null;

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-foreground">
          任务板 {done}/{total}
          {boardRun.status === "completed" ? " · 已完成" : null}
          {boardRun.status === "paused" ? " · 已暂停后续" : null}
          {boardRun.status === "failed" ? " · 已停止" : null}
          {boardRun.status === "cancelled" ? " · 已取消剩余" : null}
          {draining && boardRun.status === "running" ? " · 执行中…" : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {boardRun.status === "running" && onPause ? (
            <button
              type="button"
              className="defi-button-outline px-2 py-1 text-[10px] disabled:opacity-50"
              disabled={busy}
              onClick={onPause}
              title="当前卡跑完后不再开始下一张"
            >
              暂停后续
            </button>
          ) : null}
          {(boardRun.status === "paused" ||
            (boardRun.status === "running" && !draining && !inFlight)) &&
          onContinue ? (
            <button
              type="button"
              className="defi-button px-2 py-1 text-[10px] disabled:opacity-50"
              disabled={busy}
              onClick={onContinue}
            >
              继续
            </button>
          ) : null}
          {boardRun.status !== "completed" &&
          boardRun.status !== "cancelled" &&
          onCancelRemaining ? (
            <button
              type="button"
              className="defi-button-outline px-2 py-1 text-[10px] text-red-400/90 disabled:opacity-50"
              disabled={busy}
              onClick={onCancelRemaining}
            >
              取消剩余
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground truncate">
        {inFlight
          ? `正在改：${inFlight.title}${draining ? "（Modify 执行中，请稍候）" : ""}`
          : failed
            ? `失败：${failed.title}`
            : boardRun.status === "completed"
              ? "全部任务已结束，预览已是最新源码。"
              : draining
                ? "正在调度下一张任务卡…"
                : boardRun.goal}
      </p>
      {failed && boardRun.status === "failed" ? (
        <div className="flex gap-1">
          {onRetry ? (
            <button
              type="button"
              className="defi-button px-2 py-1 text-[10px] disabled:opacity-50"
              disabled={busy}
              onClick={() => onRetry(failed.id)}
            >
              重试此卡
            </button>
          ) : null}
          {onSkip ? (
            <button
              type="button"
              className="defi-button-outline px-2 py-1 text-[10px] disabled:opacity-50"
              disabled={busy}
              onClick={() => onSkip(failed.id)}
            >
              跳过并继续
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
