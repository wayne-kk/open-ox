"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Quiet brand disc — dusty iris on a light plate (reads on dark UI). */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const core = `${uid}-core`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block shrink-0", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={core} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#e8e2fc" />
          <stop offset="55%" stopColor="#b0a0ea" />
          <stop offset="100%" stopColor="#6e5fb0" />
        </radialGradient>
      </defs>

      <circle cx="16" cy="16" r="13" fill="#0c0c0e" />
      <circle cx="16" cy="16" r="13" stroke="#2a2a2e" strokeWidth="1" />
      <circle cx="16" cy="16" r="8" stroke="#2a2740" strokeWidth="1" />
      <circle cx="16" cy="16" r="4.75" fill={`url(#${core})`} />
      <circle cx="15.1" cy="14.6" r="1.2" fill="#efeafc" opacity="0.55" />
    </svg>
  );
}
