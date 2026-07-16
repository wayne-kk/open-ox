import type { ReactNode } from "react";

/** Mainstream product-tour step (Joyride / Shepherd / Driver.js shape). */
export type ProductTourPlacement =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "auto";

export type ProductTourMedia = {
  /** Image URL or imported static path — leave empty until assets are ready. */
  src?: string;
  alt?: string;
  /** Optional custom media (video, Lottie, etc.). Wins over `src` when set. */
  node?: ReactNode;
};

export type ProductTourStep = {
  id: string;
  /** Matches `[data-ox-tour="<id>"]` on the page. Omit / null → centered card. */
  target?: string | null;
  /** Small kicker above the title (e.g. "01 · Studio"). */
  eyebrow?: string;
  title: string;
  description: string;
  media?: ProductTourMedia;
  placement?: ProductTourPlacement;
  /** Spotlight padding around the target (px). */
  spotlightPadding?: number;
  /**
   * When the target is taller than the max spotlight, keep the top (`start`)
   * or the middle (`center`, default) of the element in view.
   */
  spotlightAlign?: "start" | "center";
  /** Cap spotlight height as a fraction of the viewport (default ~0.4). */
  spotlightMaxHeightRatio?: number;
  /** Absolute px height cap (applied after ratio). */
  spotlightMaxHeightPx?: number;
  /**
   * Optional descendant selector used to measure visible content inside a large
   * container target, while still anchoring to the target for placement.
   */
  spotlightContentSelector?: string;
  /** Whether content measurement replaces both axes or only the vertical axis. */
  spotlightContentAxis?: "both" | "vertical";
  /** Keep the hole above another `[data-ox-tour]` (e.g. conversation above modify). */
  spotlightClampAbove?: string;
  /**
   * Host hint — e.g. Studio should switch right panel when this step is shown.
   * ProductTour does not interpret this; parents handle via `onStepChange`.
   */
  panel?: "topology" | "preview" | "code";
};

export type ProductTourLabels = {
  next: string;
  back: string;
  skip: string;
  done: string;
  progress: string; // e.g. "{current} / {total}"
};
