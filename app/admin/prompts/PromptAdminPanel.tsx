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
  kind: "step" | "section";
  promptId: string;
  label: string;
  localPrompt: string;
  dbPrompt: string | null;
  effectivePrompt: string;
}

interface PromptResponse {
  profile: PromptProfile;
  canEdit: boolean;
  prompts: PromptItem[];
}

type PromptProfile = "web" | "app";

export function PromptAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [savedStepId, setSavedStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [activeProfile, setActiveProfile] = useState<PromptProfile>("web");
  const [itemsByProfile, setItemsByProfile] = useState<Record<PromptProfile, PromptItem[]>>({
    web: [],
    app: [],
  });
  const [activeStepByProfile, setActiveStepByProfile] = useState<Record<PromptProfile, string>>({
    web: "",
    app: "",
  });
  const [draftsByProfile, setDraftsByProfile] = useState<Record<PromptProfile, Record<string, string>>>({
    web: {},
    app: {},
  });

  async function load(profile: PromptProfile) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/core-prompts?profile=${profile}`);
      const data = (await res.json()) as PromptResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load prompts");
      }
      const payload = data as PromptResponse;
      const prompts = payload.prompts;
      setCanEdit(payload.canEdit);
      setItemsByProfile((prev) => ({ ...prev, [profile]: prompts }));
      setDraftsByProfile((prev) => ({
        ...prev,
        [profile]: prompts.reduce<Record<string, string>>((acc, item) => {
          acc[item.stepId] = item.dbPrompt ?? item.localPrompt;
          return acc;
        }, {}),
      }));
      setActiveStepByProfile((prev) => ({
        ...prev,
        [profile]: prev[profile] || prompts[0]?.stepId || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(activeProfile);
  }, [activeProfile]);

  async function save(profile: PromptProfile, stepId: string, promptContent: string) {
    const saveKey = `${profile}:${stepId}`;
    setSavingStepId(saveKey);
    setError(null);
    try {
      const res = await fetch("/api/core-prompts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, stepId, promptContent }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save prompt");
      }
      await load(profile);
      setSavedStepId(saveKey);
      setTimeout(() => {
        setSavedStepId((current) => (current === saveKey ? null : current));
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingStepId(null);
    }
  }

  const items = itemsByProfile[activeProfile];
  const activeStepId = activeStepByProfile[activeProfile];
  const drafts = draftsByProfile[activeProfile];
  const activeItem = items.find((item) => item.stepId === activeStepId) ?? items[0];

  const setActiveStepId = (stepId: string) => {
    setActiveStepByProfile((prev) => ({
      ...prev,
      [activeProfile]: stepId,
    }));
  };

  const updateDraft = (stepId: string, content: string) => {
    setDraftsByProfile((prev) => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        [stepId]: content,
      },
    }));
  };

  const isSavingActiveStep =
    !!activeItem && savingStepId === `${activeProfile}:${activeItem.stepId}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Prompt 管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        每个节点都支持覆盖本地 prompt。留空保存表示回退到本地默认值。
      </p>
      <div className="mt-4 inline-flex items-center rounded-lg border border-white/12 bg-white/3 p-0.5">
        <button
          type="button"
          onClick={() => setActiveProfile("web")}
          className={`rounded-md px-3 py-1 font-mono text-[11px] tracking-[0.08em] transition ${
            activeProfile === "web"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground/70 hover:text-foreground"
          }`}
          aria-pressed={activeProfile === "web"}
        >
          Web
        </button>
        <button
          type="button"
          onClick={() => setActiveProfile("app")}
          className={`rounded-md px-3 py-1 font-mono text-[11px] tracking-[0.08em] transition ${
            activeProfile === "app"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground/70 hover:text-foreground"
          }`}
          aria-pressed={activeProfile === "app"}
        >
          App
        </button>
      </div>

      {loading ? <p className="mt-6 text-sm text-muted-foreground">加载中...</p> : null}

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = activeItem?.stepId === item.stepId;
            return (
              <button
                key={item.stepId}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-white/15 bg-white/2 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveStepId(item.stepId)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {activeItem ? (
          <section className="rounded-lg border border-white/10 bg-white/2 p-4">
            <div className="mb-2">
              <h2 className="text-sm font-medium">{activeItem.label}</h2>
              <p className="text-xs text-muted-foreground">
                {activeProfile} / {activeItem.stepId}
              </p>
            </div>
            <textarea
              className="min-h-[280px] w-full scrollbar-unified rounded-md border border-white/15 bg-black/20 p-3 text-xs outline-none focus:border-primary/50"
              value={drafts[activeItem.stepId] ?? ""}
              onChange={(e) => updateDraft(activeItem.stepId, e.target.value)}
              readOnly={!canEdit}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md border border-primary/35 bg-primary/15 px-3 py-1.5 text-xs disabled:opacity-50"
                disabled={!canEdit || isSavingActiveStep}
                onClick={() => void save(activeProfile, activeItem.stepId, drafts[activeItem.stepId] ?? "")}
              >
                {isSavingActiveStep ? (
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
                    type="button"
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50"
                    disabled={!canEdit || isSavingActiveStep}
                  >
                    {isSavingActiveStep ? "处理中..." : "回退本地"}
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
                      onClick={() => void save(activeProfile, activeItem.stepId, "")}
                      className="bg-red-500 text-white hover:bg-red-500/90"
                    >
                      确认回退
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {savedStepId === `${activeProfile}:${activeItem.stepId}` ? (
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
              输入框优先回显数据库覆盖值；若无覆盖则回显本地默认 prompt。
            </p>
          </section>
        ) : null}
      </div>

      {!canEdit ? <p className="mt-4 text-sm text-amber-300">当前账号无编辑权限，仅可查看。</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </main>
  );
}
