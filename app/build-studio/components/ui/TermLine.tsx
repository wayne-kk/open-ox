import type { ReactNode } from "react";

export function TermLine({
  prefix,
  children,
  color = "text-[#c7d0dc]",
  dim = false,
}: {
  prefix?: string;
  children: ReactNode;
  color?: string;
  dim?: boolean;
}) {
  return (
    <div className={`flex gap-2 font-mono text-[12px] leading-6 tracking-[0.04em] ${dim ? "opacity-60" : ""}`}>
      {prefix ? (
        <span className="shrink-0 select-none text-muted-foreground">{prefix}</span>
      ) : null}
      <span className={color}>{children}</span>
    </div>
  );
}
