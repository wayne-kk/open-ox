"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUp, Plus } from "lucide-react";
import { type InjectedChip } from "@/app/hooks/usePromptTriggers";
import { PromptChips } from "@/app/components/ui/PromptChips";
import { QuickTemplates } from "@/app/components/ui/QuickTemplates";
import { SparkleHoverButton } from "@/components/ui/sparkle-hover-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { captureAppReturnTo } from "@/lib/navigation/appBack";
import { resolveFolderIdFromSearchParam } from "@/lib/projectFolders";
import { cn } from "@/lib/utils";

/** Survives redirect to /auth so we can resume POST /api/projects after login. */
const PENDING_BUILD_KEY = "open-ox:pending-project-build";

interface PendingBuildPayload {
  v: 1;
  value: string;
  chips: InjectedChip[];
  folderId: string | null;
}

function savePendingBuild(p: PendingBuildPayload) {
  try {
    sessionStorage.setItem(PENDING_BUILD_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}

const PLACEHOLDERS = [
  "一个项目管理工具的 SaaS 落地页...",
  "UX 设计师的个人作品集，带案例展示...",
  "手工珠宝的电商网站...",
  "加密货币仪表盘，带实时图表和钱包概览...",
  "餐厅官网，带菜单和在线预订...",
];

function composeUserPrompt(snapshot: PendingBuildPayload): string | null {
  const base = snapshot.value.trim();
  const refUrl = snapshot.chips.find((c) => c.type === "url" && c.payload.referenceUrl)?.payload
    .referenceUrl as string | undefined;
  const hasImage = snapshot.chips.some((c) => c.payload.imageBase64);

  let text = base;
  if (refUrl) {
    text = text ? `${text}\n\n参考链接：${refUrl}` : `参考链接：${refUrl}`;
  }
  if (!text && hasImage) {
    text = "根据上方截图参考生成网站";
  }
  if (!text) return null;
  return text;
}

export function HeroPrompt({
  variant = "default",
}: {
  /** `workspace` = Lovable-style large composer on /dashboard */
  variant?: "default" | "workspace";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = resolveFolderIdFromSearchParam(searchParams.get("folder"));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isWorkspace = variant === "workspace";

  const [value, setValue] = useState("");
  const [chips, setChips] = useState<InjectedChip[]>([]);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "erasing">("typing");

  useEffect(() => {
    if (focused || value) return;
    const current = PLACEHOLDERS[placeholderIdx];
    if (phase === "typing") {
      if (charIdx < current.length) {
        const t = setTimeout(() => {
          setDisplayed(current.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        }, 36);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("hold"), 2000);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => setPhase("erasing"), 600);
      return () => clearTimeout(t);
    }
    if (phase === "erasing") {
      if (charIdx > 0) {
        const t = setTimeout(() => {
          setDisplayed(current.slice(0, charIdx - 1));
          setCharIdx((c) => c - 1);
        }, 16);
        return () => clearTimeout(t);
      }
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
      setPhase("typing");
    }
  }, [phase, charIdx, placeholderIdx, focused, value]);

  const removeChip = useCallback((id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addImageChip = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setChips((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}`,
            label: "截图参考",
            type: "url",
            payload: { imageBase64: reader.result },
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const runCreateProject = useCallback(
    async (snapshot: PendingBuildPayload) => {
      const finalPrompt = composeUserPrompt(snapshot);
      if (!finalPrompt) return;

      setSubmitting(true);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: finalPrompt,
            ...(snapshot.folderId ? { folderId: snapshot.folderId } : {}),
            ...(() => {
              const img = snapshot.chips.find((c) => c.payload.imageBase64)?.payload.imageBase64;
              return typeof img === "string" && img.trim() ? { imageBase64: img.trim() } : {};
            })(),
          }),
        });
        if (res.status === 401) {
          savePendingBuild(snapshot);
          const here =
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : "/";
          router.push(`/auth?redirect=${encodeURIComponent(here)}`);
          setSubmitting(false);
          return;
        }
        const data = (await res.json()) as { projectId?: string; error?: string };
        if (!data.projectId) throw new Error(data.error ?? "Failed to create project");
        captureAppReturnTo();
        router.push(`/studio/${data.projectId}`);
      } catch (err) {
        console.error("[HeroPrompt] create project failed:", err);
        setSubmitting(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const raw = sessionStorage.getItem(PENDING_BUILD_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_BUILD_KEY);

      let pending: PendingBuildPayload;
      try {
        pending = JSON.parse(raw) as PendingBuildPayload;
      } catch {
        return;
      }
      if (pending.v !== 1) return;
      const chipsSafe = Array.isArray(pending.chips) ? pending.chips : [];
      const built = composeUserPrompt({ ...pending, chips: chipsSafe });
      if (!built) return;

      setValue(pending.value);
      setChips(chipsSafe);
      void runCreateProject({
        v: 1,
        value: pending.value,
        chips: chipsSafe,
        folderId: pending.folderId ?? null,
      });
    });
  }, [runCreateProject]);

  const submit = async () => {
    const built = composeUserPrompt({ v: 1, value, chips, folderId });
    if (!built || submitting) return;

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      savePendingBuild({ v: 1, value, chips, folderId });
      const here =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";
      router.push(`/auth?redirect=${encodeURIComponent(here)}`);
      return;
    }

    await runCreateProject({ v: 1, value, chips, folderId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const canSubmit = Boolean(composeUserPrompt({ v: 1, value, chips, folderId })) && !submitting;
  const showTemplates = chips.length === 0 && value.trim().length < 1;
  const placeholder =
    chips.length > 0
      ? "描述你想要的网站..."
      : displayed + (phase !== "erasing" && !focused && !value ? "▌" : "");

  if (isWorkspace) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mx-auto w-full max-w-3xl"
      >
        <div
          className={cn(
            "relative flex flex-col gap-3 rounded-[28px] border bg-[#0a0c10]/92 px-5 pb-3.5 pt-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all duration-200 sm:px-6 sm:pb-4 sm:pt-6",
            focused
              ? "border-primary/55 shadow-[var(--box-shadow-neon)]"
              : "border-white/10 hover:border-white/18"
          )}
        >
          <PromptChips chips={chips} onRemove={removeChip} />

          <textarea
            ref={textareaRef}
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData.items);
              const imageItem = items.find((item) => item.type.startsWith("image/"));
              if (imageItem) {
                e.preventDefault();
                const file = imageItem.getAsFile();
                if (file) addImageChip(file);
              }
            }}
            placeholder={
              chips.length > 0
                ? "描述你想要的网站..."
                : `让 OPEN-OX 帮你构建${displayed ? ` ${displayed}` : "…"}${
                    phase !== "erasing" && !focused && !value ? "▌" : ""
                  }`
            }
            className="min-h-[7.5rem] w-full resize-none bg-transparent text-[16px] leading-relaxed tracking-wide text-foreground outline-none placeholder:text-muted-foreground/80 sm:min-h-[8.5rem] sm:text-[17px]"
          />

          <div className="flex min-w-0 items-end gap-2 sm:gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addImageChip(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
              title="添加截图参考"
              aria-label="添加截图参考"
            >
              <Plus className="h-4 w-4" />
            </button>

            {showTemplates ? (
              <div className="min-h-0 min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
                <QuickTemplates
                  layout="row"
                  visible
                  onSelect={(prompt) => {
                    setValue(prompt);
                    textareaRef.current?.focus();
                  }}
                />
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              title="开始构建（⌘ Enter）"
              aria-label="开始构建"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
                canSubmit
                  ? "bg-primary text-primary-foreground shadow-[var(--box-shadow-neon-sm)] hover:brightness-110"
                  : "bg-white/10 text-white/35"
              )}
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mx-auto w-full max-w-4xl"
    >
      <div
        className={`cyber-chamfer relative flex flex-col gap-2.5 border bg-input px-5 pt-4 pb-3 transition-all duration-150 ${
          focused
            ? "border-primary shadow-[var(--box-shadow-neon)]"
            : "border-border hover:border-primary/40"
        }`}
      >
        <PromptChips chips={chips} onRemove={removeChip} />

        <div className="relative flex gap-2">
          <span
            aria-hidden
            className="select-none pt-0.5 font-mono text-[15px] font-bold text-primary drop-shadow-[0_0_6px_var(--primary)]"
          >
            &gt;
          </span>
          <textarea
            ref={textareaRef}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData.items);
              const imageItem = items.find((item) => item.type.startsWith("image/"));
              if (imageItem) {
                e.preventDefault();
                const file = imageItem.getAsFile();
                if (file) addImageChip(file);
              }
            }}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent font-mono text-[15px] leading-relaxed tracking-wide text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {showTemplates ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
              <QuickTemplates
                layout="row"
                visible
                onSelect={(prompt) => {
                  setValue(prompt);
                  textareaRef.current?.focus();
                }}
              />
            </div>
          ) : null}
          <div className={`flex shrink-0 items-center gap-2.5 ${showTemplates ? "" : "ml-auto"}`}>
            <span
              className="font-mono text-[11px] text-muted-foreground"
              title="⌘ Enter（Windows / Linux：Ctrl Enter）提交"
            >
              <kbd className="border border-border px-1 py-0.5 text-[10px]">⌘</kbd>
              <kbd className="border border-border px-1 py-0.5 text-[10px]">↵</kbd>
            </span>
            <SparkleHoverButton
              type="submit"
              disabled={!canSubmit}
              className="defi-button px-5 py-2.5 tracking-widest disabled:cursor-not-allowed disabled:opacity-30"
            >
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />{" "}
                  创建中…
                </>
              ) : (
                <>
                  构建 <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </SparkleHoverButton>
          </div>
        </div>
      </div>
    </form>
  );
}
