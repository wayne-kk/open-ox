"use client";

import { useEffect } from "react";

/** Keep `<html lang>` in sync when `[locale]` changes without remounting the root layout. */
export function DocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
