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
      ? "max-w-[86%] border-white/8 bg-white/[0.05] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      : "w-full border-white/8 bg-[#151820]/82 shadow-[0_12px_30px_rgba(0,0,0,0.2)]";
  const align = role === "user" ? "justify-end" : "justify-start";

  return (
    <div className={`flex w-full min-w-0 ${align}`}>
      <div className={`min-w-0 rounded-[20px] border px-4 py-3 ${variant}`}>
        {children}
      </div>
    </div>
  );
}
