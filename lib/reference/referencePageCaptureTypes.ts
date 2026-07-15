/**
 * Shared result type for external reference page capture (client + service).
 * Keep free of Playwright imports so Next can depend on this file safely.
 */

export type ReferencePageCapture =
  | {
      ok: true;
      finalUrl: string;
      pageTitle: string;
      pngBase64: string;
      visibleText: string;
    }
  | { ok: false; error: string };
