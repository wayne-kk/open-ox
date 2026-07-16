import type { ProductTourPlacement } from "./types";

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function measureTourTarget(
  targetId: string | null | undefined,
  padding = 8
): SpotlightRect | null {
  if (typeof document === "undefined" || !targetId) return null;
  const el = document.querySelector<HTMLElement>(`[data-ox-tour="${CSS.escape(targetId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;
  return {
    top: Math.max(0, r.top - padding),
    left: Math.max(0, r.left - padding),
    width: Math.min(window.innerWidth - Math.max(0, r.left - padding), r.width + padding * 2),
    height: Math.min(window.innerHeight - Math.max(0, r.top - padding), r.height + padding * 2),
  };
}

export function resolvePlacement(
  preferred: ProductTourPlacement | undefined,
  target: SpotlightRect | null
): Exclude<ProductTourPlacement, "auto"> {
  if (!target || preferred === "center" || !preferred) {
    if (!target) return "center";
  }
  if (preferred && preferred !== "auto") return preferred;

  // auto: prefer side with more viewport room
  const space = {
    top: target.top,
    bottom: window.innerHeight - (target.top + target.height),
    left: target.left,
    right: window.innerWidth - (target.left + target.width),
  };
  const best = (Object.entries(space) as [Exclude<ProductTourPlacement, "auto" | "center">, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0];
  return best?.[0] ?? "bottom";
}

export type PopoverPosition = { top: number; left: number };

const CARD_W = 360;
const CARD_GAP = 12;

export function placeTourPopover(
  placement: Exclude<ProductTourPlacement, "auto">,
  target: SpotlightRect | null,
  cardSize: { width: number; height: number } = { width: CARD_W, height: 220 }
): PopoverPosition {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = cardSize.width;
  const h = cardSize.height;

  if (!target || placement === "center") {
    return {
      top: Math.max(16, (vh - h) / 2),
      left: Math.max(16, (vw - w) / 2),
    };
  }

  let top = target.top;
  let left = target.left;

  switch (placement) {
    case "bottom":
      top = target.top + target.height + CARD_GAP;
      left = target.left + target.width / 2 - w / 2;
      break;
    case "top":
      top = target.top - h - CARD_GAP;
      left = target.left + target.width / 2 - w / 2;
      break;
    case "left":
      top = target.top + target.height / 2 - h / 2;
      left = target.left - w - CARD_GAP;
      break;
    case "right":
      top = target.top + target.height / 2 - h / 2;
      left = target.left + target.width + CARD_GAP;
      break;
  }

  return {
    top: Math.min(Math.max(12, top), vh - h - 12),
    left: Math.min(Math.max(12, left), vw - w - 12),
  };
}
