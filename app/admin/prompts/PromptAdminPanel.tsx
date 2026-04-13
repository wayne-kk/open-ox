"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PromptItem {
  stepId: string;
  promptId: string;
  label: string;
  localPrompt: string;
  dbPrompt: string | null;
  effectivePrompt: string;
}

interface PromptResponse {
  canEdit: boolean;
  prompts: PromptItem[];
}

export function PromptAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [savedStepId, setSavedStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [activeStepId, setActiveStepId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/core-prompts");
      const data = (await res.json()) as PromptResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load prompts");
      }
      const prompts = (data as PromptResponse).prompts;
      setItems(prompts);
      setDrafts(
        prompts.reduce<Record<string, string>>((acc, item) => {
          acc[item.stepId] = item.dbPrompt ?? "";
          return acc;
        }, {})
      );
      setActiveStepId((current) => current || prompts[0]?.stepId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(stepId: string, promptContent: string) {
    setSavingStepId(stepId);
    setError(null);
    try {
      const res = await fetch("/api/core-prompts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepId, promptContent }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save prompt");
      }
      await load();
      setSavedStepId(stepId);
      setTimeout(() => {
        setSavedStepId((current) => (current === stepId ? null : current));
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingStepId(null);
    }
  }

  const activeItem = items.find((item) => item.stepId === activeStepId) ?? items[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Prompt 管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        每个节点都支持覆盖本地 prompt。留空保存表示回退到本地默认值。
      </p>

      {loading ? <p className="mt-6 text-sm text-muted-foreground">加载中...</p> : null}

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = activeItem?.stepId === item.stepId;
            return (
              <button
                key={item.stepId}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-white/15 bg-white/[0.02] text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveStepId(item.stepId)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {activeItem ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-2">
              <h2 className="text-sm font-medium">{activeItem.label}</h2>
              <p className="text-xs text-muted-foreground">{activeItem.stepId}</p>
            </div>
            <textarea
              className="min-h-[280px] w-full rounded-md border border-white/15 bg-black/20 p-3 text-xs outline-none focus:border-primary/50"
              value={drafts[activeItem.stepId] ?? ""}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [activeItem.stepId]: e.target.value,
                }))
              }
            />
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md border border-primary/35 bg-primary/15 px-3 py-1.5 text-xs disabled:opacity-50"
                disabled={savingStepId === activeItem.stepId}
                onClick={() => void save(activeItem.stepId, drafts[activeItem.stepId] ?? "")}
              >
                {savingStepId === activeItem.stepId ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    保存中...
                  </span>
                ) : (
                  "保存"
                )}
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50"
                    disabled={savingStepId === activeItem.stepId}
                  >
                    {savingStepId === activeItem.stepId ? "处理中..." : "回退本地"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认回退到本地默认 Prompt？</AlertDialogTitle>
                    <AlertDialogDescription>
                      这会删除当前节点在数据库中的覆盖内容。删除后将立即使用本地默认 prompt。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void save(activeItem.stepId, "")}
                      className="bg-red-500 text-white hover:bg-red-500/90"
                    >
                      确认回退
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {savedStepId === activeItem.stepId ? (
                <TooltipProvider>
                  <Tooltip open>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-green-400/35 bg-green-500/10 text-green-300">
                        <Check className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>保存成功</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              输入框始终回显数据库覆盖值（若无覆盖则为空，表示使用本地默认 prompt）。
            </p>
          </section>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </main>
  );
}
