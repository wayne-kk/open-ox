import { useEffect, useRef } from "react";
import type { SlashCommand } from "@/app/hooks/useSlashMenu";

interface SlashMenuProps {
  matches: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (i: number) => void;
}

export function SlashMenu({ matches, activeIndex, onSelect, onHover }: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active item into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (matches.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="max-h-[280px] overflow-y-auto rounded-lg border border-white/8 bg-[#0a0c10]/98 backdrop-blur-xl shadow-2xl scrollbar-hidden"
    >
      {matches.map((cmd, i) => (
        <button
          key={cmd.id}
          ref={i === activeIndex ? activeRef : undefined}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(cmd); }}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-baseline gap-2.5 px-3 py-1.5 text-left transition-colors ${i === activeIndex ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
          }`}
        >
          <span className="font-mono text-[12px] text-primary shrink-0">/{cmd.id}</span>
          <span className="text-[12px] text-muted-foreground/60 truncate">{cmd.description}</span>
          {i === activeIndex && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/30 shrink-0">↵</span>
          )}
        </button>
      ))}
    </div>
  );
}
