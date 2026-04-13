"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { usePromptTriggers, detectUrl, type TriggerItem, type InjectedChip } from "@/app/hooks/usePromptTriggers";
import { TriggerMenu } from "@/app/components/ui/TriggerMenu";
import { PromptChips } from "@/app/components/ui/PromptChips";
import { QuickTemplates } from "@/app/components/ui/QuickTemplates";
import { SparkleHoverButton } from "@/components/ui/sparkle-hover-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Survives redirect to /auth so we can resume POST /api/projects after login. */
const PENDING_BUILD_KEY = "open-ox:pending-project-build";

interface PendingBuildPayload {
  v: 1;
  value: string;
  chips: InjectedChip[];
  enableSkills: boolean;
  folderId: string | null;
}

function savePendingBuild(p: PendingBuildPayload) {
  try {
    sessionStorage.setItem(PENDING_BUILD_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}

type GenerationMode = "web" | "app";

// ── Typewriter placeholders ──────────────────────────────────────────────────
const PLACEHOLDERS = [
  "一个项目管理工具的 SaaS 落地页...",
  "UX 设计师的个人作品集，带案例展示...",
  "手工珠宝的电商网站...",
  "加密货币仪表盘，带实时图表和钱包概览...",
  "餐厅官网，带菜单和在线预订...",
];

// ── Constraint tags for # trigger ────────────────────────────────────────────
const HASH_TAGS: TriggerItem[] = [
  { id: "暗色主题", label: "暗色主题", description: "深色背景配色方案", type: "hash" },
  { id: "亮色主题", label: "亮色主题", description: "浅色背景配色方案", type: "hash" },
  { id: "中文", label: "中文", description: "界面文案使用中文", type: "hash" },
  { id: "英文", label: "英文", description: "界面文案使用英文", type: "hash" },
  { id: "单页", label: "单页", description: "所有内容在一个页面", type: "hash" },
  { id: "多页", label: "多页", description: "多个独立页面", type: "hash" },
  { id: "极简", label: "极简", description: "极简主义设计风格", type: "hash" },
  { id: "响应式", label: "响应式", description: "完整的移动端适配", type: "hash" },
  { id: "动效丰富", label: "动效丰富", description: "丰富的过渡和滚动动画", type: "hash" },
  { id: "无动效", label: "无动效", description: "纯静态，无动画", type: "hash" },
];

export function HeroPrompt() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folder");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [value, setValue] = useState("");
  const [chips, setChips] = useState<InjectedChip[]>([]);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enableSkills, setEnableSkills] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("web");

  // ── Typewriter ─────────────────────────────────────────────────────────────
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "erasing">("typing");

  useEffect(() => {
    if (focused || value) return;
    const current = PLACEHOLDERS[placeholderIdx];
    if (phase === "typing") {
      if (charIdx < current.length) {
        const t = setTimeout(() => { setDisplayed(current.slice(0, charIdx + 1)); setCharIdx(c => c + 1); }, 36);
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
        const t = setTimeout(() => { setDisplayed(current.slice(0, charIdx - 1)); setCharIdx(c => c - 1); }, 16);
        return () => clearTimeout(t);
      }
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
      setPhase("typing");
    }
  }, [phase, charIdx, placeholderIdx, focused, value]);

  // ── Load trigger items from APIs ───────────────────────────────────────────
  const [triggerItems, setTriggerItems] = useState<TriggerItem[]>(HASH_TAGS);

  useEffect(() => {
    // Load skills (/ trigger)
    fetch("/api/skills")
      .then((r) => r.json())
      .then((skills: { id: string; label: string; description: string }[]) => {
        const skillItems: TriggerItem[] = skills.map((s) => ({
          id: s.id, label: s.label, description: s.description, type: "slash" as const,
        }));
        setTriggerItems((prev) => [...prev.filter((i) => i.type !== "slash"), ...skillItems]);
      })
      .catch(() => { });

    // Load projects (@ trigger) — only when logged in
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/projects?mine=1&limit=40")
        .then((r) => (r.ok ? r.json() : []))
        .then((projects: { id: string; userPrompt: string; status: string }[]) => {
          if (!Array.isArray(projects)) return;
          const projectItems: TriggerItem[] = projects
            .filter((p) => p.status === "ready")
            .slice(0, 20)
            .map((p) => ({
              id: p.id.slice(0, 20),
              label: p.userPrompt?.slice(0, 30) || p.id.slice(0, 20),
              description: `参考此项目的设计风格`,
              type: "at" as const,
              meta: { projectId: p.id },
            }));
          setTriggerItems((prev) => [...prev.filter((i) => i.type !== "at"), ...projectItems]);
        })
        .catch(() => { });
    });
  }, []);

  // ── Trigger menu ───────────────────────────────────────────────────────────
  const triggers = usePromptTriggers({
    items: triggerItems,
    value,
    setValue,
    onSelect: async (item) => {
      // Prevent duplicate chips
      if (chips.some((c) => c.id === item.id && c.type === item.type)) return;

      if (item.type === "slash") {
        // Fetch skill content
        try {
          const res = await fetch(`/skills/${item.id}.md`);
          const content = await res.text();
          setChips((prev) => [...prev, {
            id: item.id, label: item.label, type: "slash",
            payload: { styleGuide: content },
          }]);
        } catch { /* ignore */ }
      } else if (item.type === "at") {
        setChips((prev) => [...prev, {
          id: item.id, label: item.label, type: "at",
          payload: { referenceProjectId: item.meta?.projectId },
        }]);
      } else if (item.type === "hash") {
        setChips((prev) => [...prev, {
          id: item.id, label: item.label, type: "hash",
          payload: { constraint: item.id },
        }]);
      }
      textareaRef.current?.focus();
    },
  });

  // ── URL auto-detection ─────────────────────────────────────────────────────
  const lastDetectedUrl = useRef<string | null>(null);
  useEffect(() => {
    const url = detectUrl(value);
    if (url && url !== lastDetectedUrl.current && !chips.some((c) => c.type === "url" && c.payload.url === url)) {
      lastDetectedUrl.current = url;
      // Auto-inject URL chip
      const domain = new URL(url).hostname.replace("www.", "");
      setChips((prev) => [...prev, {
        id: `url-${Date.now()}`, label: domain, type: "url",
        payload: { referenceUrl: url },
      }]);
      // Remove URL from text
      setValue((v) => v.replace(url, "").trim());
    }
  }, [value, chips]);

  // ── Chip management ────────────────────────────────────────────────────────
  const removeChip = useCallback((id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Create project (snapshot-based so login resume does not depend on React state timing) ──
  const runCreateProject = useCallback(
    async (snapshot: PendingBuildPayload) => {
      const base = snapshot.value.trim();
      if (!base && snapshot.chips.length === 0) return;

      setSubmitting(true);
      try {
        const constraints = snapshot.chips
          .filter((c) => c.type === "hash")
          .map((c) => c.payload.constraint)
          .join("、");
        const constraintSuffix = constraints ? `\n\n约束条件：${constraints}` : "";
        const finalPrompt = (base || "根据提供的风格指南生成网站") + constraintSuffix;

        const styleGuide = snapshot.chips.find((c) => c.type === "slash")?.payload.styleGuide as string | undefined;
        const referenceProjectId = snapshot.chips.find((c) => c.type === "at")?.payload.referenceProjectId as
          | string
          | undefined;
        const referenceUrl = snapshot.chips.find((c) => c.type === "url")?.payload.referenceUrl as string | undefined;

        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: finalPrompt,
            ...(snapshot.folderId ? { folderId: snapshot.folderId } : {}),
            generationMode,
          ...(styleGuide ? { styleGuide } : {}),
            ...(referenceProjectId ? { referenceProjectId } : {}),
            ...(referenceUrl ? { referenceUrl } : {}),
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
        const data = await res.json() as { projectId?: string; styleGuide?: string | null; error?: string };
        if (!data.projectId) throw new Error(data.error ?? "Failed to create project");
        if (data.styleGuide) {
          sessionStorage.setItem(`styleGuide:${data.projectId}`, data.styleGuide);
        }
        if (snapshot.enableSkills) {
          sessionStorage.setItem(`enableSkills:${data.projectId}`, "true");
        }
        router.push(`/studio/${data.projectId}`);
      } catch (err) {
        console.error("[HeroPrompt] create project failed:", err);
        setSubmitting(false);
      }
    },
    [router],
  );

  // After login: if we saved a pending build, restore UI and continue the POST (atomic remove avoids double-submit).
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
      if (!pending.value?.trim() && (!pending.chips || pending.chips.length === 0)) return;

      const chipsSafe = Array.isArray(pending.chips) ? pending.chips : [];
      setValue(pending.value);
      setChips(chipsSafe);
      setEnableSkills(Boolean(pending.enableSkills));
      void runCreateProject({
        v: 1,
        value: pending.value,
        chips: chipsSafe,
        enableSkills: Boolean(pending.enableSkills),
        folderId: pending.folderId ?? null,
      });
    });
  }, [runCreateProject]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    const base = value.trim();
    if (!base && chips.length === 0) return;
    if (submitting) return;

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      savePendingBuild({ v: 1, value, chips, enableSkills, folderId });
      const here =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";
      router.push(`/auth?redirect=${encodeURIComponent(here)}`);
      return;
    }

    await runCreateProject({ v: 1, value, chips, enableSkills, folderId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (triggers.handleKeyDown(e)) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = (value.trim().length > 0 || chips.length > 0) && !submitting;
  const showTemplates = chips.length === 0 && value.trim().length < 1;

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} className="mx-auto w-full max-w-4xl">
      <div
        className={`relative flex flex-col gap-2.5 rounded-2xl border bg-[#0a0c10] px-5 pt-4 pb-3 transition-all duration-300 ${focused
          ? "border-primary/50 shadow-[0_0_40px_-10px_rgba(247,147,26,0.4)]"
          : "border-white/10 hover:border-white/18"
          }`}
      >
        {/* Injected chips */}
        <PromptChips chips={chips} onRemove={removeChip} />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            triggers.updateCursorPos(e.target.selectionStart ?? 0);
          }}
          onSelect={e => {
            triggers.updateCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? 0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            // Handle image paste
            const items = Array.from(e.clipboardData.items);
            const imageItem = items.find((item) => item.type.startsWith("image/"));
            if (imageItem) {
              e.preventDefault();
              const file = imageItem.getAsFile();
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  setChips((prev) => [...prev, {
                    id: `img-${Date.now()}`, label: "截图参考", type: "url",
                    payload: { imageBase64: reader.result },
                  }]);
                }
              };
              reader.readAsDataURL(file);
            }
          }}
          placeholder={
            chips.length > 0
              ? "描述你想要的网站..."
              : displayed + (phase !== "erasing" && !focused && !value ? "▌" : "")
          }
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55"
        />

        {/* Trigger menu — floating overlay */}
        <div className="relative">
          {triggers.isOpen && triggers.matches.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-50">
              <TriggerMenu
                matches={triggers.matches}
                activeIndex={triggers.activeIndex}
                activeTriggerType={triggers.activeTriggerType}
                onSelect={triggers.selectItem}
                onHover={triggers.setActiveIndex}
              />
            </div>
          )}
        </div>

        {/* Quick templates — shown when input is empty */}
        <QuickTemplates
          visible={showTemplates}
          onSelect={(prompt) => { setValue(prompt); textareaRef.current?.focus(); }}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-white/12 bg-white/3 p-0.5">
              <button
                type="button"
                onClick={() => setGenerationMode("web")}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] transition ${
                  generationMode === "web"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground/70 hover:text-foreground"
                }`}
                aria-pressed={generationMode === "web"}
              >
                Web
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode("app")}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] transition ${
                  generationMode === "app"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground/70 hover:text-foreground"
                }`}
                aria-pressed={generationMode === "app"}
              >
                App
              </button>
            </div>

            <span className="font-mono text-[11px] text-muted-foreground/40">
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-[10px]">/</kbd> 风格
                {" · "}
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-[10px]">@</kbd> 参考项目
                {" · "}
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-[10px]">#</kbd> 约束
                {" · ⌘↵ 构建"}
              </span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableSkills}
                onChange={(e) => setEnableSkills(e.target.checked)}
                className="h-3 w-3 rounded border border-white/20 bg-transparent accent-primary"
              />
              <span className="font-mono text-[10px] text-muted-foreground/50">Skills</span>
            </label>
          </div>
          </div>
          <SparkleHoverButton
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2.5 tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> 创建中…</>
            ) : (
              <>构建 <ArrowRight className="h-3.5 w-3.5" /></>
            )}
          </SparkleHoverButton>
        </div>
      </div>
    </form>
  );
}
