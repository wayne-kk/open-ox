"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductTourStep } from "./types";

export type UseProductTourOptions = {
  steps: ProductTourStep[];
  open: boolean;
  initialStep?: number;
  onComplete?: () => void;
  onSkip?: () => void;
};

export function useProductTour({
  steps,
  open,
  initialStep = 0,
  onComplete,
  onSkip,
}: UseProductTourOptions) {
  const [index, setIndex] = useState(initialStep);

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(0, initialStep), Math.max(0, steps.length - 1)));
  }, [open, initialStep, steps.length]);

  const step = steps[index] ?? null;
  const isFirst = index <= 0;
  const isLast = index >= steps.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      onComplete?.();
      return;
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [isLast, onComplete, steps.length]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const skip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(Math.min(Math.max(0, i), Math.max(0, steps.length - 1)));
    },
    [steps.length]
  );

  return { index, step, isFirst, isLast, next, back, skip, goTo, total: steps.length };
}
