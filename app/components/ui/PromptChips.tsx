"use client";

import Image from "next/image";
import type { InjectedChip } from "@/app/hooks/usePromptTriggers";

interface PromptChipsProps {
  chips: InjectedChip[];
  onRemove: (id: string) => void;
}

const CHIP_STYLES: Record<InjectedChip["type"], { border: string; bg: string; text: string; prefix: string }> = {
  slash: { border: "border-primary/30", bg: "bg-primary/10", text: "text-primary", prefix: "/" },
  at: { border: "border-blue-400/30", bg: "bg-blue-400/10", text: "text-blue-400", prefix: "@" },
  hash: { border: "border-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-400", prefix: "#" },
  url: { border: "border-violet-400/30", bg: "bg-violet-400/10", text: "text-violet-400", prefix: "🔗" },
};

export function PromptChips({ chips, onRemove }: PromptChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => {
        const s = CHIP_STYLES[chip.type];
        const imageData = chip.payload.imageBase64 as string | undefined;

        return (
          <span
            key={chip.id}
            className={`inline-flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} px-2.5 py-0.5 font-mono text-[11px] ${s.text}`}
          >
            {/* Image thumbnail for pasted screenshots */}
            {imageData ? (
              <img
                src={imageData}
                alt="参考截图"
                className="h-5 w-8 rounded object-cover"
              />
            ) : (
              <span className="opacity-60">{s.prefix}</span>
            )}
            {imageData ? "截图参考" : chip.label}
            <button
              type="button"
              onClick={() => onRemove(chip.id)}
              className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
              aria-label={`移除 ${chip.label}`}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
