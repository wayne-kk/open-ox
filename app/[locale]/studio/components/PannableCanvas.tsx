"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

export function PannableCanvas({ children }: { children: ReactNode }) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      setIsDragging(true);
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: translate.x,
        ty: translate.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [translate]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setTranslate({
        x: startRef.current.tx + e.clientX - startRef.current.x,
        y: startRef.current.ty + e.clientY - startRef.current.y,
      });
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setIsDragging(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  return (
    <div
      className="h-full overflow-hidden select-none"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setIsDragging(false)}
    >
      <div
        className="inline-flex min-w-max py-4"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px)`,
          willChange: isDragging ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
