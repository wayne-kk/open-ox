import type { SlashCommand } from "@/app/hooks/useSlashMenu";

interface SlashMenuProps {
  matches: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (i: number) => void;
}

export function SlashMenu({ matches, activeIndex, onSelect, onHover }: SlashMenuProps) {
  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0f14]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      {matches.map((cmd, i) => (
        <button
          key={cmd.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(cmd); }}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
            i === activeIndex ? "bg-white/8" : "hover:bg-white/4"
          }`}
        >
          <span className="font-mono text-[12px] text-primary/80 shrink-0">/{cmd.id}</span>
          <span className="text-[12px] text-muted-foreground truncate">{cmd.description}</span>
          {i === activeIndex && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 shrink-0">↵</span>
          )}
        </button>
      ))}
    </div>
  );
}
