/**
 * Preview backend selection. E2B implementation remains in `devServerManager.ts` (e2b* helpers).
 * Set OPEN_OX_PREVIEW_BACKEND=e2b to use cloud sandboxes; default is local static preview.
 */
export type PreviewBackend = "local" | "e2b";

export function getPreviewBackend(): PreviewBackend {
  const raw = process.env.OPEN_OX_PREVIEW_BACKEND?.trim().toLowerCase();
  if (raw === "e2b" || raw === "cloud") return "e2b";
  return "local";
}

export function isPreviewE2B(): boolean {
  return getPreviewBackend() === "e2b";
}
