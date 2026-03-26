import type { ReactNode } from "react";

export function LogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-3 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
