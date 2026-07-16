"use client";

import { useEffect, useRef, useCallback } from "react";
import { useFavicon, type FaviconState } from "@/app/contexts/FaviconContext";

// ── Brand palette ────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#b0a0ea",
  secondary: "#a1a1aa",
  tertiary: "#f4f4f5",
  white: "#ffffff",
  error: "#f87171",
  bg: "#09090b",
};

// ── Config ───────────────────────────────────────────────────────────────────
const SIZE = 64;
const TARGET_FPS = 24;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const OWNED_ATTR = "data-dynamic-favicon";

function isAnimatedState(state: FaviconState): boolean {
  return state !== "idle";
}

function isIconLink(node: Node): node is HTMLLinkElement {
  if (!(node instanceof HTMLLinkElement)) return false;
  const rel = (node.getAttribute("rel") || "").toLowerCase();
  return rel.split(/\s+/).some((token) => token === "icon" || token === "shortcut");
}

/** Remove every favicon <link> except our owned one (Next metadata may re-inject). */
function stripForeignIconLinks(owned: HTMLLinkElement) {
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="shortcut"]',
  )) {
    if (link !== owned) link.remove();
  }
}

/**
 * DynamicFavicon — 状态驱动的 Canvas favicon 渲染器
 *
 * States:
 *   idle     → 品牌色光点（静态一帧，避免刷 Network）
 *   thinking → 能量波纹扩散 (radar pulse)
 *   notify   → 光点 + 小红点闪烁
 *   error    → 红色闪烁 2 次后回归
 */
export function DynamicFavicon() {
  const { state } = useFavicon();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linkRef = useRef<HTMLLinkElement | null>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  const lastFrameRef = useRef(0);
  const stateRef = useRef<FaviconState>(state);
  const lastHrefRef = useRef("");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Drawing functions ────────────────────────────────────────────────────

  const drawIdle = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    // Static idle: fixed breath phase (no continuous animation → no href churn)
    const breath = 1 + Math.sin(t * 0.06) * 0.15;

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22 * breath);
    glow.addColorStop(0, `${BRAND.primary}40`);
    glow.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * breath, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 * breath);
    coreGrad.addColorStop(0, BRAND.tertiary);
    coreGrad.addColorStop(0.6, BRAND.primary);
    coreGrad.addColorStop(1, BRAND.secondary);
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * breath, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 16 * breath, 0, Math.PI * 2);
    ctx.strokeStyle = `${BRAND.primary}30`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, []);

  const drawThinking = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.8 + i * 25) % 50;
      const alpha = 1 - phase / 50;
      if (alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(cx, cy, phase * 0.5 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,136, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const startAngle = t * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, startAngle, startAngle + Math.PI * 1.2);
    ctx.strokeStyle = `${BRAND.tertiary}90`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    const pulse = 1 + Math.sin(t * 0.15) * 0.2;
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7 * pulse);
    coreGrad.addColorStop(0, BRAND.white);
    coreGrad.addColorStop(0.5, BRAND.primary);
    coreGrad.addColorStop(1, BRAND.secondary);
    ctx.beginPath();
    ctx.arc(cx, cy, 7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
  }, []);

  const drawNotify = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    coreGrad.addColorStop(0, BRAND.tertiary);
    coreGrad.addColorStop(0.6, BRAND.primary);
    coreGrad.addColorStop(1, BRAND.secondary);
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    const bounce = Math.abs(Math.sin(t * 0.12)) * 3;
    const badgeX = cx + 14;
    const badgeY = cy - 14 - bounce;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY + 1, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 6, 0, Math.PI * 2);
    ctx.fillStyle = BRAND.error;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(badgeX - 1.5, badgeY - 1.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
  }, []);

  const drawError = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    const cycle = t % 60;
    const blink = cycle < 40 ? Math.floor(cycle / 10) % 2 === 0 : true;
    const shake = cycle < 40 ? Math.sin(t * 0.8) * 2 : 0;
    const color = blink ? BRAND.error : `${BRAND.error}40`;

    if (blink) {
      const glow = ctx.createRadialGradient(cx + shake, cy, 0, cx + shake, cy, 20);
      glow.addColorStop(0, `${BRAND.error}50`);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx + shake, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx + shake, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (blink) {
      ctx.strokeStyle = BRAND.white;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + shake - 4, cy - 4);
      ctx.lineTo(cx + shake + 4, cy + 4);
      ctx.moveTo(cx + shake + 4, cy - 4);
      ctx.lineTo(cx + shake - 4, cy + 4);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  }, []);

  const paintFrame = useCallback(
    (t: number, s: FaviconState) => {
      const canvas = canvasRef.current;
      const link = linkRef.current;
      if (!canvas || !link) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = BRAND.bg;
      ctx.fill();

      switch (s) {
        case "idle":
          drawIdle(ctx, t);
          break;
        case "thinking":
          drawThinking(ctx, t);
          break;
        case "notify":
          drawNotify(ctx, t);
          break;
        case "error":
          drawError(ctx, t);
          break;
      }

      const href = canvas.toDataURL("image/png");
      // Avoid redundant assignments (browser re-evaluates favicon candidates on each write)
      if (href !== lastHrefRef.current) {
        lastHrefRef.current = href;
        link.href = href;
      }
    },
    [drawIdle, drawThinking, drawNotify, drawError],
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const draw = useCallback(
    (now: number) => {
      if (!isAnimatedState(stateRef.current)) {
        rafRef.current = 0;
        return;
      }

      if (now - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = now;

      paintFrame(tRef.current, stateRef.current);
      tRef.current += 1;
      rafRef.current = requestAnimationFrame(draw);
    },
    [paintFrame],
  );

  const startLoop = useCallback(() => {
    stopLoop();
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(draw);
  }, [draw, stopLoop]);

  // ── Visibility API: pause when tab is hidden ─────────────────────────────

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else if (isAnimatedState(stateRef.current)) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [startLoop, stopLoop]);

  // ── Bootstrap: exclusive icon link + strip Next metadata re-injects ──────

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvasRef.current = canvas;

    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.setAttribute(OWNED_ATTR, "true");
    document.head.appendChild(link);
    linkRef.current = link;

    stripForeignIconLinks(link);

    const observer = new MutationObserver((mutations) => {
      let sawForeign = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (isIconLink(node) && node !== link) {
            sawForeign = true;
            break;
          }
        }
        if (sawForeign) break;
      }
      if (sawForeign) stripForeignIconLinks(link);
    });
    observer.observe(document.head, { childList: true, subtree: true });

    // Initial idle frame (static)
    tRef.current = 0;
    paintFrame(0, "idle");

    return () => {
      observer.disconnect();
      stopLoop();
      link.remove();
      linkRef.current = null;
      canvasRef.current = null;
      lastHrefRef.current = "";
    };
  }, [paintFrame, stopLoop]);

  // ── React to state: animate only while non-idle ──────────────────────────

  useEffect(() => {
    if (isAnimatedState(state)) {
      startLoop();
      return () => stopLoop();
    }

    stopLoop();
    tRef.current = 0;
    paintFrame(0, "idle");
  }, [state, paintFrame, startLoop, stopLoop]);

  return null;
}
