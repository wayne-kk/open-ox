"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Crisp vector mark — glowing core in a dark disc (matches brand mark). */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const core = `${uid}-core`;
  const glow = `${uid}-glow`;
  const blur = `${uid}-blur`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 block", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={core} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#b8ff6a" />
          <stop offset="45%" stopColor="#5cff2e" />
          <stop offset="100%" stopColor="#00c853" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#39ff14" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#39ff14" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#39ff14" stopOpacity="0" />
        </radialGradient>
        <filter id={blur} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>

      <circle cx="16" cy="16" r="14" fill={`url(#${glow})`} />
      <circle cx="16" cy="16" r="13" fill="#070908" />
      <circle cx="16" cy="16" r="13" stroke="#1a2e1f" strokeWidth="1" />
      <circle cx="16" cy="16" r="8.25" stroke="#0d3d1c" strokeWidth="1.25" />
      <circle
        cx="16"
        cy="16"
        r="5.5"
        fill={`url(#${core})`}
        filter={`url(#${blur})`}
        opacity="0.8"
      />
      <circle cx="16" cy="16" r="4.75" fill={`url(#${core})`} />
      <circle cx="15.2" cy="14.8" r="1.35" fill="#e8ffb0" opacity="0.5" />
    </svg>
  );
}
