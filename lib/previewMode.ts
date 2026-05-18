/**
 * Preview backend selection.
 * - default: local `next dev` — `localDevServerManager.ts`
 * - e2b: cloud sandbox — `devServerManager.ts`
 * - storage: `next build` with basePath + upload `out/` to Supabase Storage `site-previews` — `staticSitePreview.ts`
 */
export type PreviewBackend = "local" | "e2b" | "storage";

export function getPreviewBackend(): PreviewBackend {
  const raw = process.env.OPEN_OX_PREVIEW_BACKEND?.trim().toLowerCase();
  if (raw === "e2b" || raw === "cloud") return "e2b";
  if (raw === "storage" || raw === "static") return "storage";
  return "local";
}

export function isPreviewE2B(): boolean {
  return getPreviewBackend() === "e2b";
}

export function isPreviewStorage(): boolean {
  return getPreviewBackend() === "storage";
}
