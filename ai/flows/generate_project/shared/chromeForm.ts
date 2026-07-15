/**
 * Chrome form + shared contracts for chrome-first generate pipeline.
 *
 * Labels are **agent-chosen** vocabulary for ownership / orchestration.
 * Do not map productType (or any scene heuristic) onto a form in code.
 */

export const CHROME_FORMS = [
  "top-nav",
  "top-nav+footer",
  "sidebar",
  "bottom-tabs",
  "page-local",
  "none",
  "unspecified",
] as const;

export type ChromeForm = (typeof CHROME_FORMS)[number];

export type SharedContract = {
  entityName: string;
  fields: string[];
  sharedComponentPath?: string;
  listSlug?: string;
  detailRoutePattern?: string;
};

const GLOBAL_CHROME_FORMS = new Set<ChromeForm>([
  "top-nav",
  "top-nav+footer",
  "sidebar",
  "bottom-tabs",
]);

export function isChromeForm(value: string): value is ChromeForm {
  return (CHROME_FORMS as readonly string[]).includes(value);
}

export function normalizeChromeForm(raw: unknown): ChromeForm {
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    const compact = trimmed.replace(/[\s_]+/g, "-").replace(/\+/g, "+");
    const aliases: Record<string, ChromeForm> = {
      "top-nav": "top-nav",
      topnav: "top-nav",
      "top-nav+footer": "top-nav+footer",
      "top-nav-footer": "top-nav+footer",
      "nav+footer": "top-nav+footer",
      "top-nav-+-footer": "top-nav+footer",
      "top-nav-+footer": "top-nav+footer",
      sidebar: "sidebar",
      "sidebar+topbar": "sidebar",
      "sidebar-topbar": "sidebar",
      "bottom-tabs": "bottom-tabs",
      bottomtabs: "bottom-tabs",
      "bottom-tab": "bottom-tabs",
      "page-local": "page-local",
      pagelocal: "page-local",
      none: "none",
      minimal: "none",
      unspecified: "unspecified",
    };
    if (aliases[compact]) return aliases[compact];
    if (aliases[trimmed]) return aliases[trimmed];
    // Loose string normalize only — not product-scene inference.
    if (/top[\s_-]*nav/.test(trimmed) && /footer/.test(trimmed)) return "top-nav+footer";
    if (/top[\s_-]*nav/.test(trimmed)) return "top-nav";
    if (/sidebar/.test(trimmed)) return "sidebar";
    if (/bottom[\s_-]*tab/.test(trimmed)) return "bottom-tabs";
    if (/page[\s_-]*local/.test(trimmed)) return "page-local";
    if (isChromeForm(compact)) return compact;
  }
  return "unspecified";
}

/** Normalize an agent-provided chromeForm. Never invents a form from productType. */
export function resolveChromeForm(params: { chromeForm?: unknown }): ChromeForm {
  return normalizeChromeForm(params.chromeForm);
}

export function needsGlobalChromeScaffold(chromeForm: ChromeForm): boolean {
  return GLOBAL_CHROME_FORMS.has(chromeForm);
}

/**
 * Skip writing/mounting global chrome (pass-through layout).
 * Only when an agent explicitly chose page-local / none.
 * Screenshot replicate is handled by the caller separately.
 */
export function shouldUsePassThroughLayout(chromeForm: ChromeForm): boolean {
  return chromeForm === "page-local" || chromeForm === "none";
}

export function normalizeSharedContracts(raw: unknown): SharedContract[] {
  if (!Array.isArray(raw)) return [];
  const out: SharedContract[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const entityName =
      typeof rec.entityName === "string" && rec.entityName.trim()
        ? rec.entityName.trim()
        : "";
    if (!entityName) continue;
    const fields = Array.isArray(rec.fields)
      ? rec.fields.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
      : [];
    const sharedComponentPath =
      typeof rec.sharedComponentPath === "string" && rec.sharedComponentPath.trim()
        ? rec.sharedComponentPath.trim().replace(/\\/g, "/")
        : undefined;
    const listSlug =
      typeof rec.listSlug === "string" && rec.listSlug.trim()
        ? rec.listSlug.trim()
        : undefined;
    const detailRoutePattern =
      typeof rec.detailRoutePattern === "string" && rec.detailRoutePattern.trim()
        ? rec.detailRoutePattern.trim()
        : undefined;
    out.push({
      entityName,
      fields,
      ...(sharedComponentPath ? { sharedComponentPath } : {}),
      ...(listSlug ? { listSlug } : {}),
      ...(detailRoutePattern ? { detailRoutePattern } : {}),
    });
  }
  return out;
}
