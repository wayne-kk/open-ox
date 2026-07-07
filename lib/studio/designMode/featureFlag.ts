/** Feature flag for Studio Design Mode Lite (P0-A). */

export function isStudioDesignModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_STUDIO_DESIGN_MODE?.trim()?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
