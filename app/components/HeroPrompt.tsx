"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useSlashMenu, type SlashCommand } from "@/app/hooks/useSlashMenu";
import { SlashMenu } from "@/app/components/ui/SlashMenu";

const PLACEHOLDERS = [
  "A SaaS landing page for a project management tool...",
  "Personal portfolio for a UX designer with case studies...",
  "E-commerce storefront for handmade jewelry...",
  "Crypto dashboard with live charts and wallet overview...",
  "Restaurant website with menu and reservations...",
];

export function HeroPrompt() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Main prompt value
  const [value, setValue] = useState("");
  // Injected skill content (appended to prompt on submit)
  const [injectedSkill, setInjectedSkill] = useState<{ id: string; label: string; content: string } | null>(null);

  // Typewriter placeholder
  const [focused, setFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "erasing">("typing");

  // Skill commands loaded from API
  const [skillCommands, setSkillCommands] = useState<SlashCommand[]>([]);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((skills: { id: string; label: string; description: string }[]) => {
        setSkillCommands(
          skills.map((s) => ({
            id: s.id,
            label: s.label,
            description: s.description,
          }))
        );
      })
      .catch(() => { });
  }, []);

  // Slash menu
  const slashMenu = useSlashMenu({
    commands: skillCommands,
    value,
    setValue,
    onSelect: async (cmd) => {
      // Fetch the skill markdown content
      const res = await fetch(`/skills/${cmd.id}.md`);
      const content = await res.text();
      setInjectedSkill({ id: cmd.id, label: cmd.label, content });
      setValue("");
      textareaRef.current?.focus();
    },
  });

  // Typewriter effect
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

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const base = value.trim();
    if (!base && !injectedSkill) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: base || `Generate a website using the provided style guide.`,
          ...(injectedSkill ? { styleGuide: injectedSkill.content } : {}),
        }),
      });
      const data = await res.json() as { projectId?: string; styleGuide?: string | null; error?: string };
      if (!data.projectId) throw new Error(data.error ?? "Failed to create project");
      // Store styleGuide in sessionStorage so useBuildStudio can pick it up
      if (data.styleGuide) {
        sessionStorage.setItem(`styleGuide:${data.projectId}`, data.styleGuide);
      }
      router.push(`/studio/${data.projectId}`);
    } catch (err) {
      console.error("[HeroPrompt] create project failed:", err);
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let slash menu handle navigation keys first
    if (slashMenu.handleKeyDown(e)) return;

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = (value.trim().length > 0 || injectedSkill !== null) && !submitting;

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} className="mx-auto w-full max-w-4xl">
      <div
        className={`relative flex flex-col gap-3 rounded-2xl border bg-[#0a0c10] px-5 pt-4 pb-3 transition-all duration-300 ${focused
          ? "border-primary/50 shadow-[0_0_40px_-10px_rgba(247,147,26,0.4)]"
          : "border-white/10 hover:border-white/18"
          }`}
      >
        {/* Injected skill badge */}
        {injectedSkill && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] text-primary">
              <span className="opacity-60">/</span>{injectedSkill.id}
              <button
                type="button"
                onClick={() => setInjectedSkill(null)}
                className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Remove skill"
              >
                ×
              </button>
            </span>
            <span className="text-[12px] text-muted-foreground/60">{injectedSkill.label} style applied</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            injectedSkill
              ? "Describe your website (skill style will be applied)..."
              : displayed + (phase !== "erasing" && !focused && !value ? "▌" : "")
          }
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55"
        />

        {/* Slash menu dropdown */}
        {slashMenu.isOpen && slashMenu.matches.length > 0 && (
          <SlashMenu
            matches={slashMenu.matches}
            activeIndex={slashMenu.activeIndex}
            onSelect={slashMenu.selectCommand}
            onHover={slashMenu.setActiveIndex}
          />
        )}

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground/40">
            Type <kbd className="rounded border border-white/10 px-1 py-0.5 text-[10px]">/</kbd> for style skills · ⌘↵ to build
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Creating…</>
            ) : (
              <>Build <ArrowRight className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
