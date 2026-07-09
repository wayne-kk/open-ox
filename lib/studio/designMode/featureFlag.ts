/** Feature flags for Studio Design Mode. */

import { getPreviewBackend } from "@/lib/previewMode";

/**
 * Env gate for **Direct Apply** (floating style/Tailwind editor + patch API).
 * Does **not** gate element pick / selection → Modify.
 */
export function isStudioDesignModeDirectEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_STUDIO_DESIGN_MODE?.trim()?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

/**
 * @deprecated Use {@link isStudioDesignModeDirectEnabled} — name kept for older call sites.
 * Historically gated all of Design Mode; pick is now always available.
 */
export function isStudioDesignModeEnabled(): boolean {
  return isStudioDesignModeDirectEnabled();
}

/**
 * True only when Studio may show the Direct editor and accept PATCH writes:
 * local `next dev` preview **and** Direct env enabled.
 */
export function isDesignModeDirectEditCapable(): boolean {
  return getPreviewBackend() === "local" && isStudioDesignModeDirectEnabled();
}
