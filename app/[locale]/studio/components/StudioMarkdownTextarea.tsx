"use client";

import { useEffect, useRef } from "react";
import { StudioMessageMarkdown } from "./StudioMessageMarkdown";
import { cn } from "@/lib/utils";

function shouldShowMarkdownPreview(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("\n")) return true;
  return /(?:^|\n)\s{0,3}(?:[-*+]|\d+\.)\s|#{1,6}\s|```|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)/.test(
    trimmed
  );
}

type StudioMarkdownTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> & {
  className?: string;
  previewClassName?: string;
  showPreview?: boolean;
  onAutoResize?: (element: HTMLTextAreaElement) => void;
};

export function StudioMarkdownTextarea({
  className,
  previewClassName,
  showPreview = true,
  value = "",
  onChange,
  onAutoResize,
  ...props
}: StudioMarkdownTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textValue = typeof value === "string" ? value : String(value ?? "");
  const previewVisible = showPreview && shouldShowMarkdownPreview(textValue);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !onAutoResize) return;
    onAutoResize(el);
  }, [textValue, onAutoResize]);

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        className={cn(
          "w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/50 max-h-[min(40vh,360px)] overflow-y-auto scrollbar-unified disabled:opacity-40 disabled:cursor-not-allowed whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          className
        )}
        {...props}
      />
      {previewVisible ? (
        <div
          className={cn(
            "max-h-[min(28vh,240px)] overflow-y-auto rounded-xl border border-border bg-muted/50 px-3 py-2.5 scrollbar-unified",
            previewClassName
          )}
        >
          <StudioMessageMarkdown content={textValue} />
        </div>
      ) : null}
    </div>
  );
}
