import type { ReactNode } from "react";

export function ChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  const variant =
    role === "user"
      ? "max-w-[86%] border-border bg-muted/60 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      : "relative w-full overflow-hidden border-primary/20 bg-card/80 shadow-[0_12px_30px_rgba(0,0,0,0.2)]";
  const align = role === "user" ? "justify-end" : "justify-start";

  return (
    <div className={`flex w-full min-w-0 ${align}`}>
      <div className={`min-w-0 rounded-[20px] border px-4 py-3 ${variant}`}>
        {role === "assistant" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent"
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}
