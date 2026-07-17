/**
 * Attach entry grant to Storage preview URLs so cross-origin iframes
 * (dedicated `NEXT_PUBLIC_PREVIEW_ORIGIN`) can bootstrap without Studio cookies.
 */

import { isPreviewStorage } from "@/lib/previewMode";
import { withPreviewAccessGrantQuery } from "@/lib/previewOrigin";
import { mintPreviewAccessGrant } from "@/lib/staticSitePreviewProxyAccess";

export function attachPreviewAccessGrantIfNeeded<T extends { url: string }>(
  projectId: string,
  result: T
): T {
  if (!isPreviewStorage()) return result;
  const token = mintPreviewAccessGrant(projectId);
  if (!token) return result;
  return { ...result, url: withPreviewAccessGrantQuery(result.url, token) };
}
