import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clampProjectListName } from "@/lib/projectDisplayName";
import {
  getProject,
  getSiteRoot,
  type ProjectMetadata,
} from "@/lib/projectManager";
import { ensureProjectSourcesOnDisk, uploadFullProject } from "@/lib/storage";

/** Basename / relative-path patterns excluded from Remix copies. */
const REMIX_EXCLUDE_NAMES = new Set([
  "node_modules",
  ".next",
  "out",
  ".git",
  ".DS_Store",
  "Thumbs.db",
]);

function isExcludedRelativePath(relPosix: string): boolean {
  const parts = relPosix.split("/").filter(Boolean);
  for (const part of parts) {
    if (REMIX_EXCLUDE_NAMES.has(part)) return true;
    if (part === ".env" || part.startsWith(".env.")) return true;
    if (part.endsWith(".pem") || part.endsWith(".key")) return true;
  }
  return false;
}

export function shouldExcludeFromRemix(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return isExcludedRelativePath(normalized);
}

async function copySiteTreeFiltered(srcRoot: string, destRoot: string): Promise<number> {
  let copied = 0;

  async function walk(rel: string): Promise<void> {
    const srcDir = rel ? path.join(srcRoot, rel) : srcRoot;
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const posixRel = childRel.replace(/\\/g, "/");
      if (shouldExcludeFromRemix(posixRel)) continue;
      const srcPath = path.join(srcRoot, childRel);
      const destPath = path.join(destRoot, childRel);
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await walk(childRel);
      } else if (entry.isFile()) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
        copied += 1;
      }
    }
  }

  await fs.mkdir(destRoot, { recursive: true });
  await walk("");
  return copied;
}

function remixDisplayName(sourceName: string): string {
  const base = sourceName.trim() || "未命名项目";
  const withSuffix = base.endsWith("(Remix)") ? base : `${base} (Remix)`;
  return clampProjectListName(withSuffix) || "Remix";
}

export type RemixProjectResult = {
  project: ProjectMetadata;
  filesCopied: number;
};

/**
 * Remix: copy latest site source (+ display metadata + lineage) into a new owner project.
 * Does not copy Studio chat. Excludes secrets / build artifacts.
 */
export async function remixProject(params: {
  adminDb: SupabaseClient;
  remixerDb: SupabaseClient;
  sourceProjectId: string;
  remixerUserId: string;
  remixerUsername: string;
}): Promise<RemixProjectResult> {
  const { adminDb, remixerDb, sourceProjectId, remixerUserId, remixerUsername } = params;

  const source = await getProject(adminDb, sourceProjectId);
  if (!source) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  if (source.publishPreview !== true || source.allowRemix !== true) {
    throw new Error("REMIX_NOT_ALLOWED");
  }

  await ensureProjectSourcesOnDisk(sourceProjectId, { db: adminDb });
  const srcRoot = getSiteRoot(sourceProjectId);
  try {
    await fs.access(path.join(srcRoot, "package.json"));
  } catch {
    throw new Error("SOURCE_FILES_MISSING");
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace(/\./g, "-");
  const id = `${timestamp}_remix`;
  const createdAt = now.toISOString();
  const name = remixDisplayName(source.name);

  const row = {
    id,
    name,
    user_prompt: source.userPrompt || name,
    status: "ready" as const,
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: createdAt,
    model_id: source.modelId ?? null,
    generation_mode: source.generationMode ?? "web",
    user_id: remixerUserId,
    owner_username: remixerUsername,
    folder_id: null,
    modification_history: [],
    publish_preview: false,
    allow_remix: false,
    listing: "listed",
    remixed_from_project_id: source.id,
    remixed_from_title: source.name,
    remixed_from_owner_username: source.ownerUsername ?? null,
    reference_image_data_url: null,
  };

  const { data, error } = await remixerDb.from("projects").insert(row).select().single();
  if (error || !data) {
    throw new Error(`[remixProject] insert failed: ${error?.message}`);
  }

  const destRoot = getSiteRoot(id);
  let filesCopied = 0;
  try {
    filesCopied = await copySiteTreeFiltered(srcRoot, destRoot);
    // Ensure package name matches new project id when present.
    const pkgPath = path.join(destRoot, "package.json");
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8")) as {
        name?: string;
        [key: string]: unknown;
      };
      pkg.name = id;
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    } catch {
      // optional
    }
    await uploadFullProject(id);
  } catch (err) {
    await fs.rm(destRoot, { recursive: true, force: true }).catch(() => undefined);
    await remixerDb.from("projects").delete().eq("id", id);
    throw err;
  }

  const project = (await getProject(remixerDb, id))!;
  return { project, filesCopied };
}
