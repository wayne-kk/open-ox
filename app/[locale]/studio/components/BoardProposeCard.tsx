"use client";

import { useEffect, useState } from "react";
import { BOARD_RUN_MAX_TASKS, type BoardRun, type BoardTaskInput } from "@/lib/modify/boardRun/boardRunTypes";

type Props = {
  boardRun: BoardRun;
  busy?: boolean;
  onRevise: (tasks: BoardTaskInput[]) => Promise<void>;
  onConfirm: (tasks: BoardTaskInput[]) => Promise<void>;
  onDecline: () => Promise<void>;
};

function toInputs(run: BoardRun): BoardTaskInput[] {
  return run.tasks.map((t) => ({ title: t.title, instruction: t.instruction }));
}

export function BoardProposeCard({ boardRun, busy, onRevise, onConfirm, onDecline }: Props) {
  const [tasks, setTasks] = useState<BoardTaskInput[]>(() => toInputs(boardRun));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTasks(toInputs(boardRun));
    setError(null);
  }, [boardRun.id]);

  function updateTask(index: number, patch: Partial<BoardTaskInput>) {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function moveTask(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= tasks.length) return;
    setTasks((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
  }

  function addTask() {
    if (tasks.length >= BOARD_RUN_MAX_TASKS) return;
    setTasks((prev) => [...prev, { title: "新任务", instruction: "" }]);
  }

  async function persistRevise() {
    setError(null);
    try {
      await onRevise(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function handleConfirm() {
    setError(null);
    try {
      await onConfirm(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败");
    }
  }

  async function handleDecline() {
    setError(null);
    try {
      await onDecline();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="text-[11px] font-medium text-foreground">建议拆成任务板</div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        广域改站将按卡片串行执行。可先编辑列表，再确认；或改回单条 Modify。
      </p>
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div key={index} className="rounded-md border border-border/80 bg-background p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input
                className="flex-1 bg-transparent text-[12px] font-medium text-foreground outline-none"
                value={task.title}
                disabled={busy}
                onChange={(e) => updateTask(index, { title: e.target.value })}
                onBlur={() => void persistRevise()}
              />
              <button
                type="button"
                className="px-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={busy || index === 0}
                onClick={() => moveTask(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="px-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={busy || index >= tasks.length - 1}
                onClick={() => moveTask(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="px-1 text-[10px] text-red-400/90 hover:text-red-400 disabled:opacity-40"
                disabled={busy || tasks.length <= 2}
                onClick={() => {
                  const next = tasks.filter((_, i) => i !== index);
                  setTasks(next);
                  void onRevise(next).catch((e) =>
                    setError(e instanceof Error ? e.message : "保存失败")
                  );
                }}
              >
                删
              </button>
            </div>
            <textarea
              className="w-full resize-none bg-transparent text-[11px] text-muted-foreground outline-none min-h-[48px]"
              value={task.instruction}
              disabled={busy}
              onChange={(e) => updateTask(index, { instruction: e.target.value })}
              onBlur={() => void persistRevise()}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="defi-button-outline px-3 py-1.5 text-[11px] disabled:opacity-50"
          disabled={busy || tasks.length >= BOARD_RUN_MAX_TASKS}
          onClick={addTask}
        >
          加卡 ({tasks.length}/{BOARD_RUN_MAX_TASKS})
        </button>
        <button
          type="button"
          className="defi-button px-3 py-1.5 text-[11px] disabled:opacity-50"
          disabled={busy}
          onClick={() => void handleConfirm()}
        >
          确认任务板
        </button>
        <button
          type="button"
          className="defi-button-outline px-3 py-1.5 text-[11px] disabled:opacity-50"
          disabled={busy}
          onClick={() => void handleDecline()}
        >
          按一条 Modify 跑
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
