"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SparkleHoverButtonProps = React.ComponentProps<"button">;

export function SparkleHoverButton({ className, children, ...props }: SparkleHoverButtonProps) {
  return (
    <>
      <button
        type="button"
        className={cn(
          "sparkle-hover-btn group relative inline-flex items-center gap-2 rounded-xl px-6 py-3 font-mono text-[12px] font-bold uppercase",
          className,
        )}
        {...props}
      >
        <span className="star star-1" aria-hidden>✦</span>
        <span className="star star-2" aria-hidden>✦</span>
        <span className="star star-3" aria-hidden>✦</span>
        <span className="star star-4" aria-hidden>✦</span>
        <span className="star star-5" aria-hidden>✦</span>
        <span className="star star-6" aria-hidden>✦</span>
        {children}
      </button>
      <style jsx>{`
        .sparkle-hover-btn {
          background: #fec195;
          color: #181818;
          border: 2px solid #fec195;
          box-shadow: 0 0 0 rgba(254, 193, 149, 0.55);
          transition: all 0.3s ease-in-out;
        }
        .sparkle-hover-btn:hover {
          background: transparent;
          color: #fec195;
          box-shadow: 0 0 25px rgba(254, 193, 149, 0.55);
        }
        .sparkle-hover-btn:disabled {
          cursor: not-allowed;
          pointer-events: none;
          box-shadow: none;
        }
        .sparkle-hover-btn:disabled:hover {
          background: #fec195;
          color: #181818;
          box-shadow: none;
        }
        .star {
          position: absolute;
          color: #fffdef;
          line-height: 1;
          filter: drop-shadow(0 0 0 #fffdef);
          z-index: -1;
          transition: all 0.8s cubic-bezier(0, 0.4, 0, 1.01);
          pointer-events: none;
        }
        .star-1 { top: 20%; left: 20%; font-size: 16px; transition-duration: 1s; }
        .star-2 { top: 45%; left: 45%; font-size: 11px; transition-duration: 1s; }
        .star-3 { top: 40%; left: 40%; font-size: 8px; }
        .star-4 { top: 20%; left: 40%; font-size: 9px; }
        .star-5 { top: 25%; left: 45%; font-size: 11px; transition-duration: 0.6s; }
        .star-6 { top: 5%; left: 50%; font-size: 8px; transition-duration: 0.8s; }
        .sparkle-hover-btn:hover .star {
          z-index: 2;
          filter: drop-shadow(0 0 10px #fffdef);
        }
        .sparkle-hover-btn:disabled .star {
          opacity: 0;
          filter: none;
          transform: none;
        }
        .sparkle-hover-btn:hover .star-1 { top: -80%; left: -30%; }
        .sparkle-hover-btn:hover .star-2 { top: -25%; left: 10%; }
        .sparkle-hover-btn:hover .star-3 { top: 55%; left: 25%; }
        .sparkle-hover-btn:hover .star-4 { top: 30%; left: 80%; }
        .sparkle-hover-btn:hover .star-5 { top: 25%; left: 115%; }
        .sparkle-hover-btn:hover .star-6 { top: 5%; left: 60%; }
      `}</style>
    </>
  );
}
