"use client";

import { useEffect, useRef } from "react";
import type { TriggerItem, TriggerType } from "@/app/hooks/usePromptTriggers";

interface TriggerMenuProps {
  matches: TriggerItem[];
  activeIndex: number;
  activeTriggerType: TriggerType | null;
  onSelect: (item: TriggerItem) => void;
  onHover: (i: number) => void;
}

const TRIGGER_LABELS: Record<TriggerType, { prefix: string; color: string }> = {
  slash: { prefix: "/", color: "text-primary" },
  at: { prefix: "@", color: "text-blue-400" },
  hash: { prefix: "#", color: "text-emerald-400" },
};

export function TriggerMenu({ matches, activeIndex, activeTriggerType, onSelect, onHover }: TriggerMenuProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (matches.length === 0) return null;

  const style = activeTriggerType ? TRIGGER_LABELS[activeTriggerType] : TRIGGER_LABELS.slash;

  return (
    <div className="max-h-[280px] overflow-y-auto rounded-lg border border-white/8 bg-[#0a0c10]/98 backdrop-blur-xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {matches.map((item, i) => (
        <button
          key={`${item.type}-${item.id}`}
          ref={i === activeIndex ? activeRef : undefined}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-baseline gap-2.5 px-3 py-1.5 text-left transition-colors ${
            i === activeIndex ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
          }`}
        >
          <span className={`font-mono text-[12px] shrink-0 ${style.color}`}>
            {style.prefix}{item.id}
          </span>
          <span className="text-[12px] text-muted-foreground/60 truncate">{item.description}</span>
          {i === activeIndex && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/30 shrink-0">↵</span>
          )}
        </button>
      ))}
    </div>
  );
}
