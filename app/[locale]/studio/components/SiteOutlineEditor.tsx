"use client";

import {
  SITE_OUTLINE_MODULE_TYPES,
  createModule,
  siteOutlineModuleTypeLabel,
  type SiteOutline,
  type SiteOutlineModule,
  type SiteOutlineModuleType,
} from "@/lib/studio/siteOutline";
import { cn } from "@/lib/utils";

type SiteOutlineEditorProps = {
  outline: SiteOutline;
  onChange: (next: SiteOutline) => void;
  disabled?: boolean;
};

function moveModule(modules: SiteOutlineModule[], from: number, to: number): SiteOutlineModule[] {
  if (to < 0 || to >= modules.length || from === to) return modules;
  const next = [...modules];
  const [item] = next.splice(from, 1);
  if (!item) return modules;
  next.splice(to, 0, item);
  return next;
}

export function SiteOutlineEditor({ outline, onChange, disabled }: SiteOutlineEditorProps) {
  const modules = outline.modules;

  function updateModules(nextModules: SiteOutlineModule[]) {
    onChange({ ...outline, modules: nextModules });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
      <div className="space-y-1">
        <div className="text-[12px] font-medium text-foreground">首页模块结构</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          模块结构预览；生成后可在 Studio 继续改。这是线框，不是最终设计。
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">页面目标</span>
        <input
          type="text"
          disabled={disabled}
          value={outline.pageGoal}
          onChange={(e) => onChange({ ...outline, pageGoal: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-primary/50"
        />
      </label>

      <div className="space-y-2">
        {modules.map((mod, index) => (
          <div
            key={mod.id}
            className="rounded-xl border border-dashed border-border/80 bg-background/60 px-2.5 py-2"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {siteOutlineModuleTypeLabel(mod.type)}
                  </span>
                  <input
                    type="text"
                    disabled={disabled}
                    value={mod.title}
                    onChange={(e) => {
                      const next = [...modules];
                      next[index] = { ...mod, title: e.target.value };
                      updateModules(next);
                    }}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12px] font-medium text-foreground outline-none focus:border-border"
                  />
                </div>
                <input
                  type="text"
                  disabled={disabled}
                  value={mod.intent ?? ""}
                  placeholder="模块意图（可选）"
                  onChange={(e) => {
                    const next = [...modules];
                    next[index] = { ...mod, intent: e.target.value || undefined };
                    updateModules(next);
                  }}
                  className="w-full rounded border border-transparent bg-transparent px-1 text-[11px] text-muted-foreground outline-none focus:border-border"
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => updateModules(moveModule(modules, index, index - 1))}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index >= modules.length - 1}
                  onClick={() => updateModules(moveModule(modules, index, index + 1))}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled || modules.length <= 1}
                  onClick={() => updateModules(modules.filter((_, i) => i !== index))}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-red-400/90 disabled:opacity-30"
                >
                  删
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SITE_OUTLINE_MODULE_TYPES.filter((t) => t !== "custom").map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => updateModules([...modules, createModule(type as SiteOutlineModuleType)])}
            className={cn(
              "rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground",
              "hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            )}
          >
            + {siteOutlineModuleTypeLabel(type)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => updateModules([...modules, createModule("custom", { title: "自定义模块" })])}
          className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          + 自定义
        </button>
      </div>
    </div>
  );
}
