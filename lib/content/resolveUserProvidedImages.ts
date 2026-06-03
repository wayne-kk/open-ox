import type { UserProvidedContent, UserProvidedImage } from "@/ai/flows/generate_project/types";
import { downloadProjectImage, sanitizeImageFilename } from "@/lib/content/siteImageAsset";

export type ResolveUserProvidedImagesStats = {
  imageTotal: number;
  downloaded: number;
  failed: number;
  attempts: Array<{
    index: number;
    url: string;
    urlLength: number;
    ok: boolean;
    path?: string;
    error?: string;
  }>;
  failures: Array<{ index: number; url: string; error: string }>;
};

function filenameForImage(image: UserProvidedImage, index: number): string {
  if (image.caption?.trim()) {
    return sanitizeImageFilename(`user-${image.caption.slice(0, 40)}-${index + 1}`);
  }
  return sanitizeImageFilename(`user-provided-${index + 1}`);
}

function logImageAttempt(params: {
  index: number;
  total: number;
  url: string;
  caption?: string;
  role?: string;
}): void {
  const meta = [
    params.caption ? `caption=${params.caption}` : "",
    params.role ? `role=${params.role}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  console.log(
    `[resolve_user_provided_images] image ${params.index + 1}/${params.total} ` +
      `(${params.url.length} chars)${meta ? ` ${meta}` : ""}\n  url: ${params.url}`
  );
}

/**
 * Download each user image URL to /images/... — no AI generation in this step.
 * Failed downloads are left for Page Agent to handle via generate_image.
 */
export async function resolveUserProvidedImages(
  content: UserProvidedContent
): Promise<{ content: UserProvidedContent; stats: ResolveUserProvidedImagesStats }> {
  const images = content.images ?? [];
  if (images.length === 0) {
    return {
      content,
      stats: { imageTotal: 0, downloaded: 0, failed: 0, attempts: [], failures: [] },
    };
  }

  console.log(`[resolve_user_provided_images] starting download for ${images.length} image(s)`);

  const resolved: UserProvidedImage[] = [];
  let downloaded = 0;
  let failed = 0;
  const attempts: ResolveUserProvidedImagesStats["attempts"] = [];
  const failures: ResolveUserProvidedImagesStats["failures"] = [];

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const filenameBase = filenameForImage(image, i);

    logImageAttempt({
      index: i,
      total: images.length,
      url: image.url,
      caption: image.caption,
      role: image.role,
    });

    const downloadResult = await downloadProjectImage({
      url: image.url,
      filenameBase,
    });

    if (downloadResult.ok) {
      downloaded += 1;
      console.log(
        `[resolve_user_provided_images] image ${i + 1}/${images.length} ok → ${downloadResult.path}`
      );
      attempts.push({
        index: i,
        url: image.url,
        urlLength: image.url.length,
        ok: true,
        path: downloadResult.path,
      });
      resolved.push({
        url: image.url,
        caption: image.caption,
        role: image.role,
        path: downloadResult.path,
        source: "download",
      });
      continue;
    }

    failed += 1;
    console.warn(
      `[resolve_user_provided_images] image ${i + 1}/${images.length} failed: ${downloadResult.error}\n  url: ${image.url}`
    );
    attempts.push({
      index: i,
      url: image.url,
      urlLength: image.url.length,
      ok: false,
      error: downloadResult.error,
    });
    failures.push({
      index: i,
      url: image.url,
      error: downloadResult.error,
    });
    resolved.push({
      url: image.url,
      caption: image.caption,
      role: image.role,
      error: downloadResult.error,
    });
  }

  console.log(
    `[resolve_user_provided_images] done: ${downloaded} downloaded, ${failed} failed (of ${images.length})`
  );

  return {
    content: { ...content, images: resolved },
    stats: {
      imageTotal: images.length,
      downloaded,
      failed,
      attempts,
      failures,
    },
  };
}
