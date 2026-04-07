"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

interface NodeBurstFxProps {
  variant: "success" | "failure";
  triggerKey: number;
  size?: "sm" | "md" | "lg" | "xl";
}

export function NodeBurstFx({ variant, triggerKey, size = "md" }: NodeBurstFxProps) {
  const [visible, setVisible] = useState(false);
  const sizeScale = size === "sm" ? 0.8 : size === "lg" ? 1.5 : size === "xl" ? 2 : 1;

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 14;
        const baseDistance = variant === "success" ? 18 + (i % 3) * 6 : 10 + (i % 2) * 4;
        const distance = baseDistance * sizeScale;
        const successPalette = [
          "#22d3ee", // cyan
          "#f472b6", // pink
          "#60a5fa", // blue
          "#a78bfa", // purple
          "#facc15", // yellow
          "#ffffff", // white
        ];
        return {
          id: i,
          dx: `${Math.cos(angle) * distance}px`,
          dy: `${Math.sin(angle) * distance}px`,
          delay: `${(i % 5) * 18}ms`,
          color: variant === "success" ? successPalette[i % successPalette.length] : `hsl(${(i * 12) % 20} 90% 56%)`,
        };
      }),
    [sizeScale, variant],
  );

  useEffect(() => {
    if (!triggerKey) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 500);
    return () => window.clearTimeout(timer);
  }, [triggerKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {variant === "failure" && <span className="node-fail-ring" />}
      {particles.map((p) => (
        <span
          key={`${variant}-${triggerKey}-${p.id}`}
          className={variant === "success" ? "node-success-dot" : "node-fail-dot"}
          style={
            {
              ["--dx" as string]: p.dx,
              ["--dy" as string]: p.dy,
              ["--delay" as string]: p.delay,
              ["--dot-color" as string]: p.color,
              ["--dot-size" as string]: `${4 * sizeScale}px`,
              ["--ring-inset" as string]: `${8 * sizeScale}px`,
            } as CSSProperties
          }
        />
      ))}
      <style jsx>{`
        .node-success-dot,
        .node-fail-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--dot-size);
          height: var(--dot-size);
          border-radius: 9999px;
          transform: translate(-50%, -50%) scale(0.2);
          opacity: 0;
        }

        .node-success-dot {
          background: var(--dot-color);
          box-shadow: 0 0 14px 3px var(--dot-color);
          animation: node-success-burst 420ms ease-out forwards;
          animation-delay: var(--delay);
        }

        .node-fail-dot {
          background: var(--dot-color);
          box-shadow: 0 0 10px 2px color-mix(in srgb, var(--dot-color) 80%, #fff 20%);
          animation: node-fail-spark 380ms ease-out forwards;
          animation-delay: var(--delay);
        }

        .node-fail-ring {
          position: absolute;
          inset: var(--ring-inset);
          border-radius: 14px;
          border: 2px solid rgba(239, 68, 68, 0.65);
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.35);
          animation: node-fail-ring 360ms ease-out forwards;
        }

        @keyframes node-success-burst {
          0% {
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1);
            opacity: 0;
          }
        }

        @keyframes node-fail-spark {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.9);
            opacity: 0;
          }
        }

        @keyframes node-fail-ring {
          0% {
            transform: scale(0.65);
            opacity: 1;
          }
          100% {
            transform: scale(1.05);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
