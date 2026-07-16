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
};

export type ProductTourLabels = {
  next: string;
  back: string;
  skip: string;
  done: string;
  progress: string; // e.g. "{current} / {total}"
};
