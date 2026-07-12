"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const GLSLHills = dynamic(
  () => import("@/components/ui/glsl-hills").then((m) => m.GLSLHills),
  { ssr: false }
);

type Props = {
  className?: string;
  cameraZ?: number;
  speed?: number;
};

/**
 * Defer WebGL until idle (or short timeout) so LCP / TBT are not blocked by Three.js.
 */
export function DeferredGLSLHills(props: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(enable, { timeout: 1200 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const timer = window.setTimeout(enable, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background ${props.className ?? ""}`}
      />
    );
  }

  return <GLSLHills {...props} />;
}
