"use client";

import { useEffect, useRef, useCallback } from "react";
import { useFavicon, type FaviconState } from "@/app/contexts/FaviconContext";

// ── Brand palette ────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#f7931a",       // accent orange
  secondary: "#ea580c",     // accent-secondary
  tertiary: "#ffd600",      // accent-tertiary
  white: "#ffffff",
  error: "#ef4444",         // destructive red
  bg: "#030304",            // background
};

// ── Config ───────────────────────────────────────────────────────────────────
const SIZE = 64;
const TARGET_FPS = 24;                       // favicon 不需要 60fps
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/**
 * DynamicFavicon — 状态驱动的 Canvas favicon 渲染器
 *
 * States:
 *   idle     → 品牌色呼吸光点
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

  // Keep ref in sync so the animation loop always reads the latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Drawing functions ────────────────────────────────────────────────────

  const drawIdle = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const breath = 1 + Math.sin(t * 0.06) * 0.15;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22 * breath);
    glow.addColorStop(0, `${BRAND.primary}40`);
    glow.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * breath, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Core dot
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 * breath);
    coreGrad.addColorStop(0, BRAND.tertiary);
    coreGrad.addColorStop(0.6, BRAND.primary);
    coreGrad.addColorStop(1, BRAND.secondary);
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * breath, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Subtle halo ring
    ctx.beginPath();
    ctx.arc(cx, cy, 16 * breath, 0, Math.PI * 2);
    ctx.strokeStyle = `${BRAND.primary}30`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, []);

  const drawThinking = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Two staggered ripples
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.8 + i * 25) % 50;
      const alpha = 1 - phase / 50;
      if (alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(cx, cy, phase * 0.5 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(247, 147, 26, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Spinning arc
    const startAngle = t * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, startAngle, startAngle + Math.PI * 1.2);
    ctx.strokeStyle = `${BRAND.tertiary}90`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    // Core dot (pulsing faster)
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

    // Main dot
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    coreGrad.addColorStop(0, BRAND.tertiary);
    coreGrad.addColorStop(0.6, BRAND.primary);
    coreGrad.addColorStop(1, BRAND.secondary);
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Notification badge — gentle bounce
    const bounce = Math.abs(Math.sin(t * 0.12)) * 3;
    const badgeX = cx + 14;
    const badgeY = cy - 14 - bounce;

    // Badge shadow
    ctx.beginPath();
    ctx.arc(badgeX, badgeY + 1, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fill();

    // Badge
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 6, 0, Math.PI * 2);
    ctx.fillStyle = BRAND.error;
    ctx.fill();

    // Badge highlight
    ctx.beginPath();
    ctx.arc(badgeX - 1.5, badgeY - 1.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
  }, []);

  const drawError = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // 2-blink cycle over ~50 frames, then solid
    const cycle = t % 60;
    const blink = cycle < 40 ? Math.floor(cycle / 10) % 2 === 0 : true;

    // Shake offset
    const shake = cycle < 40 ? Math.sin(t * 0.8) * 2 : 0;

    const color = blink ? BRAND.error : `${BRAND.error}40`;

    // Error glow
    if (blink) {
      const glow = ctx.createRadialGradient(cx + shake, cy, 0, cx + shake, cy, 20);
      glow.addColorStop(0, `${BRAND.error}50`);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx + shake, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Core
    ctx.beginPath();
    ctx.arc(cx + shake, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // X mark
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

  // ── Animation loop ───────────────────────────────────────────────────────

  const draw = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      const link = linkRef.current;
      if (!canvas || !link) return;

      // Throttle to TARGET_FPS
      if (now - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = now;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Dark background circle (so the icon is visible on any tab bar)
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = BRAND.bg;
      ctx.fill();

      const t = tRef.current;
      const s = stateRef.current;

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

      // Push to favicon
      link.href = canvas.toDataURL("image/png");
      tRef.current = t + 1;
      rafRef.current = requestAnimationFrame(draw);
    },
    [drawIdle, drawThinking, drawNotify, drawError],
  );

  // ── Visibility API: pause when tab is hidden ─────────────────────────────

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Pause animation when tab is hidden
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
        // Resume
        lastFrameRef.current = 0;
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [draw]);

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Create canvas (off-screen)
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvasRef.current = canvas;

    // Create or reuse <link rel="icon">
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    linkRef.current = link;

    // Start loop
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // This component renders nothing visible
  return null;
}
