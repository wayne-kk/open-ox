import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { assertUrlSafeForServerFetch } from "@/lib/net/safePublicUrl";
import { generateArkImageBase64 } from "@/lib/ark-image-generate";
import { getSiteRoot } from "@/ai/tools/system/common";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 12_000_000;

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

export function writePublicImage(params: {
  filenameBase: string;
  buffer: Buffer;
  ext: string;
  subdir?: string;
}): string {
  const ext = params.ext.replace(/^\./, "").toLowerCase() || "jpg";
  const filename = `${sanitizeImageFilename(params.filenameBase)}.${ext}`;
  const subdir = params.subdir?.replace(/^\/+|\/+$/g, "") || "images/user-provided";
  const siteRoot = getSiteRoot();
  const dir = join(siteRoot, "public", subdir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(dir, filename), params.buffer);
  return `/${subdir}/${filename}`;
}

function extFromContentType(contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  return "jpg";
}

function extFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/);
    if (!match) return null;
    return match[1] === "jpeg" ? "jpg" : match[1];
  } catch {
    return null;
  }
}

export async function downloadRemoteImage(
  url: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    const safeUrl = await assertUrlSafeForServerFetch(url);
    const res = await fetch(safeUrl.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;

    const ext = extFromUrl(url) ?? extFromContentType(contentType);
    return { buffer: buf, ext };
  } catch (err) {
    console.warn(
      `[siteImageAsset] download failed for ${url.slice(0, 120)}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

function buildGenerationPrompt(caption: string | undefined, sourceUrl: string): string {
  const base =
    caption?.trim() ||
    "Professional photograph for a business website, warm lighting, sharp focus, no text or logos";
  const normalized = base.replace(/\s+/g, " ").trim();
  const suffix = ", sharp focus, 4K, no text, no logos, no watermarks";
  const combined = `${normalized}${suffix}`;
  return combined.length > 160 ? combined.slice(0, 160) : combined;
}

export async function resolveSiteImageAsset(params: {
  sourceUrl: string;
  caption?: string;
  filenameBase: string;
}): Promise<{ publicPath: string; source: "download" | "generated" | "failed" }> {
  const filenameBase = sanitizeImageFilename(params.filenameBase);

  const downloaded = await downloadRemoteImage(params.sourceUrl);
  if (downloaded) {
    const publicPath = writePublicImage({
      filenameBase,
      buffer: downloaded.buffer,
      ext: downloaded.ext,
    });
    return { publicPath, source: "download" };
  }

  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    console.warn(`[siteImageAsset] ARK_API_KEY not set; cannot generate fallback for ${filenameBase}`);
    return { publicPath: "", source: "failed" };
  }

  try {
    const prompt = buildGenerationPrompt(params.caption, params.sourceUrl);
    const b64 = await generateArkImageBase64({ prompt, size: "1k" });
    const publicPath = writePublicImage({
      filenameBase,
      buffer: Buffer.from(b64, "base64"),
      ext: "png",
    });
    return { publicPath, source: "generated" };
  } catch (err) {
    console.error(
      `[siteImageAsset] generate fallback failed for ${filenameBase}:`,
      err instanceof Error ? err.message : err
    );
    return { publicPath: "", source: "failed" };
  }
}
