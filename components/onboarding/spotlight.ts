import type { ProductTourPlacement } from "./types";

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Matched from target computed style when available. */
  radius?: number;
};

export type PopoverPosition = { top: number; left: number };

const CARD_GAP = 16;
const VIEW_PAD = 16;
/** Huge targets (e.g. full prompt hero) must not eat the viewport. */
const MAX_SPOTLIGHT_VH = 0.4;
const MAX_SPOTLIGHT_VW = 0.7;

type RectLike = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function pickVisibleTourTarget(targetId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-ox-tour="${CSS.escape(targetId)}"]`
  );
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const el of nodes) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // Prefer on-screen nodes
    const visibleW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
    const visibleH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    const area = Math.max(0, visibleW) * Math.max(0, visibleH);
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  }
  return best;
}

function visibleContentRect(
  container: HTMLElement,
  containerRect: RectLike,
  selector: string | undefined,
  axis: "both" | "vertical" = "both"
): RectLike | null {
  if (!selector) return null;
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      continue;
    }
    const r = node.getBoundingClientRect();
    const clippedLeft = Math.max(r.left, containerRect.left, 0);
    const clippedTop = Math.max(r.top, containerRect.top, 0);
    const clippedRight = Math.min(r.right, containerRect.right, vw);
    const clippedBottom = Math.min(r.bottom, containerRect.bottom, vh);
    if (clippedRight - clippedLeft < 1 || clippedBottom - clippedTop < 1) continue;
    top = Math.min(top, clippedTop);
    left = Math.min(left, clippedLeft);
    right = Math.max(right, clippedRight);
    bottom = Math.max(bottom, clippedBottom);
  }

  if (!Number.isFinite(top) || !Number.isFinite(left)) return null;

  if (axis === "vertical") {
    return {
      top,
      left: containerRect.left,
      width: containerRect.width,
      height: bottom - top,
      right: containerRect.right,
      bottom,
    };
  }

  return { top, left, width: right - left, height: bottom - top, right, bottom };
}

function readRadius(el: HTMLElement): number {
  const raw = window.getComputedStyle(el).borderTopLeftRadius;
  const n = Number.parseFloat(raw || "0");
  return Number.isFinite(n) ? n : 12;
}

/**
 * Tight spotlight around the visible `[data-ox-tour]` node.
 *
 * Algorithm:
 * 1. Find the most visible `[data-ox-tour="<id>"]` → bounding box + padding.
 * 2. Cap width/height to viewport ratios (and optional px max).
 * 3. If capped, crop from top (`align: "start"`) or center.
 * 4. Optional `clampAboveTargetId`: force bottom edge above another target
 *    (conversation must stop above Modify — even when the scroll rail is taller).
 */
export function measureTourTarget(
  targetId: string | null | undefined,
  padding = 6,
  opts?: {
    align?: "start" | "center";
    maxHeightRatio?: number;
    maxWidthRatio?: number;
    /** Absolute px cap (applied after ratio). */
    maxHeightPx?: number;
    /** Descendants used to shrink a large target to visible content. */
    contentSelector?: string;
    /** Keep full target width while shrinking only to content height. */
    contentAxis?: "both" | "vertical";
    /** Keep the hole above this other `[data-ox-tour]` node. */
    clampAboveTargetId?: string;
    gapAboveClamp?: number;
  }
): SpotlightRect | null {
  if (!targetId) return null;
  const el = pickVisibleTourTarget(targetId);
  if (!el) return null;
  const targetRect = el.getBoundingClientRect();
  if (targetRect.width < 1 && targetRect.height < 1) return null;
  const r =
    visibleContentRect(el, targetRect, opts?.contentSelector, opts?.contentAxis) ?? targetRect;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.max(120, vw * (opts?.maxWidthRatio ?? MAX_SPOTLIGHT_VW));
  let maxH = Math.max(80, vh * (opts?.maxHeightRatio ?? MAX_SPOTLIGHT_VH));
  if (typeof opts?.maxHeightPx === "number" && opts.maxHeightPx > 0) {
    maxH = Math.min(maxH, opts.maxHeightPx);
  }
  const align = opts?.align ?? "center";
  const radius = readRadius(el);

  const width = Math.min(r.width + padding * 2, maxW);
  let height = Math.min(r.height + padding * 2, maxH);
  let left = r.left + r.width / 2 - width / 2;
  let top =
    align === "start" || r.height + padding * 2 <= maxH
      ? r.top - padding
      : r.top + r.height / 2 - height / 2;

  // Always honor ceiling when set (primary fix for tall flex-1 rails).
  if (opts?.clampAboveTargetId) {
    const ceilingEl = pickVisibleTourTarget(opts.clampAboveTargetId);
    if (ceilingEl) {
      const gap = opts.gapAboveClamp ?? 12;
      const maxBottom = ceilingEl.getBoundingClientRect().top - gap;
      if (top + height > maxBottom) {
        height = Math.max(72, maxBottom - top);
      }
    }
  }

  left = Math.min(Math.max(0, left), Math.max(0, vw - width));
  top = Math.min(Math.max(0, top), Math.max(0, vh - height));

  return { top, left, width, height, radius };
}

function spaceAround(target: SpotlightRect) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    top: target.top - VIEW_PAD,
    bottom: vh - (target.top + target.height) - VIEW_PAD,
    left: target.left - VIEW_PAD,
    right: vw - (target.left + target.width) - VIEW_PAD,
  };
}

export function resolvePlacement(
  preferred: ProductTourPlacement | undefined,
  target: SpotlightRect | null,
  cardSize: { width: number; height: number } = { width: 360, height: 280 }
): Exclude<ProductTourPlacement, "auto"> {
  if (!target || preferred === "center") return "center";
  if (!preferred || preferred === "auto") {
    return pickBestPlacement(target, cardSize);
  }

  const space = spaceAround(target);
  const need =
    preferred === "top" || preferred === "bottom"
      ? cardSize.height + CARD_GAP
      : cardSize.width + CARD_GAP;
  if (space[preferred] >= need) return preferred;
  return pickBestPlacement(target, cardSize);
}

function pickBestPlacement(
  target: SpotlightRect,
  cardSize: { width: number; height: number }
): Exclude<ProductTourPlacement, "auto" | "center"> {
  const space = spaceAround(target);
  const ranked = (
    Object.entries(space) as [Exclude<ProductTourPlacement, "auto" | "center">, number][]
  ).sort((a, b) => b[1] - a[1]);

  for (const [side, room] of ranked) {
    const need =
      side === "top" || side === "bottom" ? cardSize.height + CARD_GAP : cardSize.width + CARD_GAP;
    if (room >= need) return side;
  }
  return ranked[0]?.[0] ?? "bottom";
}

function rawPlace(
  placement: Exclude<ProductTourPlacement, "auto">,
  target: SpotlightRect,
  w: number,
  h: number
): PopoverPosition {
  switch (placement) {
    case "bottom":
      return {
        top: target.top + target.height + CARD_GAP,
        left: target.left + target.width / 2 - w / 2,
      };
    case "top":
      return {
        top: target.top - h - CARD_GAP,
        left: target.left + target.width / 2 - w / 2,
      };
    case "left":
      return {
        top: target.top + target.height / 2 - h / 2,
        left: target.left - w - CARD_GAP,
      };
    case "right":
      return {
        top: target.top + target.height / 2 - h / 2,
        left: target.left + target.width + CARD_GAP,
      };
    case "center":
    default:
      return { top: 0, left: 0 };
  }
}

/** Keep the full card inside the viewport (no bottom/side clipping). */
export function clampToViewport(pos: PopoverPosition, w: number, h: number): PopoverPosition {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxTop = Math.max(VIEW_PAD, vh - h - VIEW_PAD);
  const maxLeft = Math.max(VIEW_PAD, vw - w - VIEW_PAD);
  return {
    top: Math.min(Math.max(VIEW_PAD, pos.top), maxTop),
    left: Math.min(Math.max(VIEW_PAD, pos.left), maxLeft),
  };
}

function overlaps(a: SpotlightRect, b: SpotlightRect, gap = 8): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

/**
 * Place the step card beside the spotlight, preferring free space and
 * avoiding overlap with the hole. Guarantees the card stays on-screen.
 */
export function placeTourPopover(
  placement: Exclude<ProductTourPlacement, "auto">,
  target: SpotlightRect | null,
  cardSize: { width: number; height: number } = { width: 360, height: 280 }
): PopoverPosition {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(cardSize.width, vw - VIEW_PAD * 2);
  const h = Math.min(cardSize.height, vh - VIEW_PAD * 2);

  if (!target || placement === "center") {
    return {
      top: Math.max(VIEW_PAD, (vh - h) / 2),
      left: Math.max(VIEW_PAD, (vw - w) / 2),
    };
  }

  const resolved = resolvePlacement(placement, target, { width: w, height: h });
  if (resolved === "center") {
    return {
      top: Math.max(VIEW_PAD, (vh - h) / 2),
      left: Math.max(VIEW_PAD, (vw - w) / 2),
    };
  }

  let pos = clampToViewport(rawPlace(resolved, target, w, h), w, h);
  const cardRect: SpotlightRect = { top: pos.top, left: pos.left, width: w, height: h };

  if (!overlaps(cardRect, target)) return pos;

  for (const side of ["right", "left", "top", "bottom"] as const) {
    const candidate = clampToViewport(rawPlace(side, target, w, h), w, h);
    const rect: SpotlightRect = {
      top: candidate.top,
      left: candidate.left,
      width: w,
      height: h,
    };
    if (!overlaps(rect, target)) return candidate;
  }

  // Safe corner with the most free space — still clamped fully on-screen.
  const space = spaceAround(target);
  pos = {
    top: space.bottom >= space.top ? VIEW_PAD : Math.max(VIEW_PAD, vh - h - VIEW_PAD),
    left: space.right >= space.left ? Math.max(VIEW_PAD, vw - w - VIEW_PAD) : VIEW_PAD,
  };
  // Prefer the opposite side of a bottom-left target (credits): top-right.
  if (target.top > vh * 0.55 && target.left < vw * 0.35) {
    pos = { top: VIEW_PAD, left: Math.max(VIEW_PAD, vw - w - VIEW_PAD) };
  }
  return clampToViewport(pos, w, h);
}
