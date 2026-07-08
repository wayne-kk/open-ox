import type { DesignModeElementRect } from "./protocol";

export interface FloatingEditorBox {
  top: number;
  left: number;
}

/** Position popup below selected element, clamped inside the preview container. */
export function computeFloatingEditorPosition(
  elementRect: DesignModeElementRect,
  iframeOffset: { top: number; left: number },
  containerSize: { width: number; height: number },
  popupSize: { width: number; height: number },
  gap = 8
): FloatingEditorBox {
  const anchorLeft = iframeOffset.left + elementRect.left;
  const anchorTop = iframeOffset.top + elementRect.top;
  const anchorBottom = anchorTop + elementRect.height;

  let top = anchorBottom + gap;
  let left = anchorLeft;

  if (top + popupSize.height > containerSize.height) {
    top = Math.max(gap, anchorTop - popupSize.height - gap);
  }

  if (left + popupSize.width > containerSize.width) {
    left = Math.max(gap, containerSize.width - popupSize.width - gap);
  }

  left = Math.max(gap, Math.min(left, containerSize.width - popupSize.width - gap));
  top = Math.max(gap, Math.min(top, containerSize.height - popupSize.height - gap));

  return { top, left };
}
