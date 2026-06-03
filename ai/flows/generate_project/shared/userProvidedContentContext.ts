import type { UserProvidedContent } from "../types";
import { USER_PROVIDED_CONTENT_PATH } from "@/lib/content/userProvidedContentText";

/** Strip server-side download metadata so Page Agent does not treat fetch failures as "missing images". */
export function prepareUserProvidedContentForPageAgent(
  content: UserProvidedContent | undefined
): UserProvidedContent | undefined {
  if (!content?.images?.length) return content;
  return {
    ...content,
    images: content.images.map(({ url, caption, role, path, source }) => {
      const hasLocalFile = Boolean(path?.trim() && source === "download");
      return hasLocalFile
        ? { url, caption, role, path, source }
        : { url, caption, role };
    }),
  };
}

export function userProvidedImageCount(content: UserProvidedContent | undefined): number {
  return content?.images?.filter((img) => img.url?.trim()).length ?? 0;
}

/** Inline URL list so the agent does not skip remote src when read_file is delayed. */
export function userProvidedContentImagesBlock(content: UserProvidedContent | undefined): string {
  const images = content?.images?.filter((img) => img.url?.trim()) ?? [];
  if (images.length === 0) return "";
  const lines = images.map((img, i) => {
    const meta = [img.role, img.caption].filter(Boolean).join(" — ");
    return `${i + 1}. \`${img.url}\`${meta ? ` (${meta})` : ""}`;
  });
  return (
    `\n\n## User-provided photos (${images.length} unique URLs)\n` +
    `- Use each URL **at most once** as remote \`src\` (\`<img>\` or \`next/image>\`). Do **not** reuse the same URL in multiple slots.\n` +
    `- Do **not** call \`generate_image\` to duplicate or replace any listed photo.\n` +
    `- After all ${images.length} URL(s) are assigned, if the layout still needs more images, use \`generate_image\` only for **additional** slots (saved under \`public/images/\`).\n` +
    `- Ignore any \`error\` / download notes on these URLs — the browser loads Google CDN; server fetch is irrelevant.\n\n` +
    lines.join("\n") +
    `\n`
  );
}

/** Page Agent only — points at the plain-text user content file. */
export function userProvidedContentFileHint(hasContent: boolean): string {
  if (!hasContent) return "";
  return (
    `\n\n## User query (organized)\n` +
    `Read \`${USER_PROVIDED_CONTENT_PATH}\` with \`read_file\`. ` +
    `Use Google / user image URLs from that file **directly** as remote \`src\` (do not download). ` +
    `Each user photo URL may appear only once. When every user URL is used and more images are still needed, call \`generate_image\` for extras only.\n`
  );
}
