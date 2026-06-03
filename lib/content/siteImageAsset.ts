import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { generateArkImageBase64 } from "@/lib/ark-image-generate";
import { assertUrlSafeForServerFetch } from "@/lib/net/safePublicUrl";
import { formatFetchError, serverFetch } from "@/lib/net/serverFetch";
import { getSiteRoot } from "@/ai/tools/system/common";

/** All site images live under public/images/ → `/images/...` in TSX. */
export const PROJECT_IMAGES_SUBDIR = "images";

const FETCH_TIMEOUT_MS = 120_000;
const MAX_IMAGE_BYTES = 12_000_000;
const MAX_PROMPT_CHARS = 160;
const DOWNLOAD_RETRIES = 2;

const FETCH_HEADERS: Record<string, string> = {
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: "https://www.google.com/",
};

export function sanitizeImageFilename(raw: string): string {
  return (
    raw
      .replace(/\.(png|jpe?g|webp|gif|avif)$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "image"
  );
}

export function sanitizeImagePrompt(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_PROMPT_CHARS
    ? normalized.slice(0, MAX_PROMPT_CHARS)
    : normalized;
}

/** Project-relative public path, e.g. `/images/hero-bg.png`. */
export function projectImagePath(filenameBase: string, ext: string): string {
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "png";
  const filename = `${sanitizeImageFilename(filenameBase)}.${safeExt}`;
  return `/${PROJECT_IMAGES_SUBDIR}/${filename}`;
}

export function writePublicImage(params: {
  filenameBase: string;
  buffer: Buffer;
  ext: string;
  subdir?: string;
}): string {
  const ext = params.ext.replace(/^\./, "").toLowerCase() || "jpg";
  const filename = `${sanitizeImageFilename(params.filenameBase)}.${ext}`;
  const subdir = params.subdir?.replace(/^\/+|\/+$/g, "") || PROJECT_IMAGES_SUBDIR;
  const siteRoot = getSiteRoot();
  const dir = join(siteRoot, "public", subdir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(dir, filename), params.buffer);
  return `/${subdir}/${filename}`;
}

/** Write bytes to public/images/ and return project-relative path. */
export function saveProjectImage(params: {
  filenameBase: string;
  buffer: Buffer;
  ext: string;
}): string {
  return writePublicImage({
    filenameBase: params.filenameBase,
    buffer: params.buffer,
    ext: params.ext,
    subdir: PROJECT_IMAGES_SUBDIR,
  });
}

function extFromContentType(contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "jpg";
}

function isLikelyImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return true;
  }
  return false;
}

function isAcceptableImageResponse(contentType: string | null, buf: Buffer): boolean {
  if (!contentType) return isLikelyImageBuffer(buf);
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) return true;
  if (ct.includes("octet-stream") || ct.includes("binary")) return isLikelyImageBuffer(buf);
  return false;
}

export type ProjectImageResult =
  | { ok: true; path: string; bytes: number }
  | { ok: false; error: string };

type FetchedImageBody =
  | { ok: true; buf: Buffer; contentType: string | null }
  | { ok: false; error: string };

async function fetchImageBody(url: URL): Promise<FetchedImageBody> {
  const res = await serverFetch(url.toString(), {
    method: "GET",
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText}`.trim() };
  }

  const contentType = res.headers.get("content-type");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: `invalid size (${buf.length} bytes)` };
  }

  if (!isAcceptableImageResponse(contentType, buf)) {
    return { ok: false, error: `not an image (${contentType ?? "unknown type"})` };
  }

  return { ok: true, buf, contentType };
}

/** Download a remote URL into public/images/. Same path contract as generate. */
export async function downloadProjectImage(params: {
  url: string;
  filenameBase: string;
}): Promise<ProjectImageResult> {
  let safeUrl: URL;
  try {
    safeUrl = await assertUrlSafeForServerFetch(params.url);
  } catch (err) {
    return { ok: false, error: formatFetchError(err) };
  }

  let lastError = "unknown error";

  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    try {
      const body = await fetchImageBody(safeUrl);
      if (!body.ok) {
        lastError = body.error;
        if (body.error.startsWith("HTTP ")) {
          return { ok: false, error: body.error };
        }
        continue;
      }

      const path = saveProjectImage({
        filenameBase: params.filenameBase,
        buffer: body.buf,
        ext: extFromContentType(body.contentType),
      });

      return { ok: true, path, bytes: body.buf.length };
    } catch (err) {
      lastError = formatFetchError(err);
      if (attempt < DOWNLOAD_RETRIES) {
        console.warn(
          `[downloadProjectImage] attempt ${attempt}/${DOWNLOAD_RETRIES} failed: ${lastError}`
        );
      }
    }
  }

  return { ok: false, error: lastError };
}

/** Generate via Ark into public/images/. Same path contract as download. */
export async function generateProjectImage(params: {
  filenameBase: string;
  prompt: string;
}): Promise<ProjectImageResult> {
  const prompt = sanitizeImagePrompt(params.prompt);
  if (!prompt) {
    return { ok: false, error: "prompt is required" };
  }

  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "ARK_API_KEY not set" };
  }

  try {
    const b64 = await generateArkImageBase64({ prompt, size: "1k" });
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0) {
      return { ok: false, error: "empty generated image" };
    }

    const path = saveProjectImage({
      filenameBase: params.filenameBase,
      buffer: buf,
      ext: "png",
    });

    return { ok: true, path, bytes: buf.length };
  } catch (err) {
    return { ok: false, error: formatFetchError(err) };
  }
}
