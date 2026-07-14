import fs from "fs/promises";
import path from "path";

/** Written after a successful static-export `next build` so sync can reuse `out/`. */
export const STATIC_PREVIEW_BUILD_STAMP_REL = ".open-ox/static-preview-build-stamp.json";

export type StaticPreviewBuildStamp = {
  filesFingerprint: string;
  basePath: string;
  builtAt: string;
};

function stampPath(projectDir: string): string {
  return path.join(projectDir, ...STATIC_PREVIEW_BUILD_STAMP_REL.split("/"));
}

export async function writeStaticPreviewBuildStamp(
  projectDir: string,
  stamp: StaticPreviewBuildStamp
): Promise<void> {
  const full = stampPath(projectDir);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, `${JSON.stringify(stamp, null, 2)}\n`, "utf-8");
}

/** Drop reuse stamp when local `out/` is deleted or known incomplete. */
export async function clearStaticPreviewBuildStamp(projectDir: string): Promise<void> {
  await fs.unlink(stampPath(projectDir)).catch(() => undefined);
}

export async function readStaticPreviewBuildStamp(
  projectDir: string
): Promise<StaticPreviewBuildStamp | null> {
  try {
    const raw = await fs.readFile(stampPath(projectDir), "utf-8");
    const parsed = JSON.parse(raw) as Partial<StaticPreviewBuildStamp>;
    if (
      typeof parsed.filesFingerprint !== "string" ||
      typeof parsed.basePath !== "string" ||
      !parsed.filesFingerprint.trim() ||
      !parsed.basePath.trim()
    ) {
      return null;
    }
    return {
      filesFingerprint: parsed.filesFingerprint.trim(),
      basePath: parsed.basePath.trim(),
      builtAt: typeof parsed.builtAt === "string" ? parsed.builtAt : "",
    };
  } catch {
    return null;
  }
}

/**
 * True when verification (or a prior sync) already produced a matching `out/` for this
 * fingerprint + Storage basePath — sync can upload without another `next build`.
 */
export async function canReuseStaticExportOut(
  projectDir: string,
  filesFingerprint: string,
  basePath: string
): Promise<boolean> {
  const stamp = await readStaticPreviewBuildStamp(projectDir);
  if (!stamp) return false;
  if (stamp.filesFingerprint !== filesFingerprint) return false;
  if (stamp.basePath !== basePath) return false;
  try {
    await fs.access(path.join(projectDir, "out", "index.html"));
    return true;
  } catch {
    return false;
  }
}

/** Upload hit a path that vanished — usually concurrent rebuild/rm of `out/`. */
export function isStaticPreviewOutAssetMissingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.startsWith("STATIC_PREVIEW_OUT_MISSING:")) return true;
  const code = (err as NodeJS.ErrnoException).code;
  return code === "ENOENT" && /[/\\]out[/\\]/i.test(err.message);
}
