/**
 * Preview backend selection.
 * - **development, env unset**: if Supabase + `NEXT_PUBLIC_SITE_URL` + service role are configured,
 *   defaults to **storage** (static export → bucket + `/site-previews` proxy) so local matches prod CDN preview.
 *   Set `OPEN_OX_PREVIEW_BACKEND=local` to force each site’s `next dev` preview instead.
 * - **production / `next start`, env unset**: **local** (set `OPEN_OX_PREVIEW_BACKEND=storage` in deploy env).
 * - **e2b**: cloud sandbox — `devServerManager.ts`
 * - **storage**: `staticSitePreview.ts` (also the dev default above when deps exist)
 */
export type PreviewBackend = "local" | "e2b" | "storage";

function storagePreviewDepsPresent(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SITE_URL?.trim()
  );
}

export function getPreviewBackend(): PreviewBackend {
  const raw = process.env.OPEN_OX_PREVIEW_BACKEND?.trim()?.toLowerCase();
  if (raw === "e2b" || raw === "cloud") return "e2b";
  if (raw === "storage" || raw === "static") return "storage";
  if (raw === "local") return "local";

  if (process.env.NODE_ENV === "development" && storagePreviewDepsPresent()) {
    return "storage";
  }

  return "local";
}

export function isPreviewE2B(): boolean {
  return getPreviewBackend() === "e2b";
}

export function isPreviewStorage(): boolean {
  return getPreviewBackend() === "storage";
}
