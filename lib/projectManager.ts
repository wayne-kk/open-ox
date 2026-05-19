import fs from "fs/promises";
import path from "path";
import { Dirent } from "fs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clampProjectListName } from "@/lib/projectDisplayName";
import { ensureProjectNodeModules as ensureProjectNodeModulesImpl } from "@/lib/ensureProjectNodeModules";

export const WORKSPACE_ROOT = process.cwd();

/** Re-export from leaf module so preview/storage bundles never see a half-initialized `projectManager` namespace. */
export async function ensureProjectNodeModules(projectDir: string): Promise<void> {
  return ensureProjectNodeModulesImpl(projectDir);
}
export type GenerationMode = "web";

function coerceGenerationMode(_stored: string | null | undefined): GenerationMode {
  return "web";
}

export interface ModificationRecord {
  instruction: string;
  modifiedAt: string;
  touchedFiles: string[];
  plan?: {
    analysis: string;
    changes: Array<{ path: string; action: string; reasoning: string }>;
  };
  diffs?: Array<{
    file: string;
    reasoning: string;
    patch: string;
    stats: { additions: number; deletions: number };
  }>;
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  thinking?: string[];
  image?: string | null;
  error?: string;
}

export type ProjectCoverImageStatus = "pending" | "ready" | "failed";

export interface ProjectMetadata {
  id: string;
  name: string;
  userPrompt: string;
  status: "awaiting_input" | "generating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  verificationStatus?: "passed" | "failed";
  blueprint?: unknown;
  buildSteps?: unknown[];
  generatedFiles?: string[];
  logDirectory?: string;
  totalDuration?: number;
  modelId?: string;
  generationMode: GenerationMode;
  folderId?: string | null;
  modificationHistory: ModificationRecord[];
  /** Set when row includes ownership columns */
  ownerUserId?: string;
  ownerUsername?: string | null;
  /** Desktop-first-viewport screenshot in Storage (.open-ox-cover/cover.jpg) */
  coverImageStatus?: ProjectCoverImageStatus;
  coverImageStoragePath?: string | null;
  coverImageError?: string | null;
  coverImageUpdatedAt?: string;
  /** Active background generation run (`019_generation_runs`) */
  currentGenerationRunId?: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  user_prompt: string;
  status: "awaiting_input" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  verification_status: "passed" | "failed" | null;
  blueprint: unknown;
  build_steps: unknown[] | null;
  generated_files: string[] | null;
  log_directory: string | null;
  total_duration: number | null;
  model_id: string | null;
  generation_mode: string | null;
  user_id: string | null;
  folder_id: string | null;
  owner_username?: string | null;
  modification_history: ModificationRecord[];
  cover_image_status: ProjectCoverImageStatus | null;
  cover_image_storage_path: string | null;
  cover_image_error: string | null;
  cover_image_updated_at: string | null;
  current_generation_run_id: string | null;
}

function rowToMetadata(row: ProjectRow): ProjectMetadata {
  return {
    id: row.id,
    name: row.name,
    userPrompt: row.user_prompt,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    verificationStatus: row.verification_status ?? undefined,
    blueprint: row.blueprint,
    buildSteps: row.build_steps ?? undefined,
    generatedFiles: row.generated_files ?? undefined,
    logDirectory: row.log_directory ?? undefined,
    totalDuration: row.total_duration ?? undefined,
    modelId: row.model_id ?? undefined,
    generationMode: coerceGenerationMode(row.generation_mode),
    folderId: row.folder_id ?? undefined,
    modificationHistory: row.modification_history ?? [],
    ...(row.user_id
      ? {
          ownerUserId: row.user_id,
          ownerUsername: row.owner_username ?? undefined,
        }
      : {}),
    coverImageStatus: row.cover_image_status ?? undefined,
    coverImageStoragePath: row.cover_image_storage_path ?? undefined,
    coverImageError: row.cover_image_error ?? undefined,
    coverImageUpdatedAt: row.cover_image_updated_at ?? undefined,
    currentGenerationRunId: row.current_generation_run_id ?? undefined,
  };
}

export function getSiteRoot(projectId: string): string {
  const sitesDir = path.join(WORKSPACE_ROOT, "sites");
  const resolved = path.join(sitesDir, projectId);
  if (!resolved.startsWith(sitesDir + path.sep) && resolved !== sitesDir) {
    throw new Error(`Path traversal detected: "${projectId}" escapes WORKSPACE_ROOT/sites/`);
  }
  return resolved;
}

interface ProjectListRow {
  id: string;
  name: string;
  user_prompt: string;
  status: "awaiting_input" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  verification_status: "passed" | "failed" | null;
  model_id: string | null;
  generation_mode: string | null;
  folder_id: string | null;
  user_id: string | null;
  owner_username: string | null;
  cover_image_status: ProjectCoverImageStatus | null;
}

export type ProjectFolderFilter = "all" | "uncategorized" | string;

interface ProjectOwnerRow {
  user_id: string | null;
  owner_username: string | null;
  created_at: string;
}

export interface ProjectOwnerOption {
  id: string;
  label: string;
}

/**
 * Fast list query for dashboard/autocomplete.
 * Avoid selecting heavy JSON columns (blueprint/build_steps/generated_files/modification_history).
 * Pass `userId` to scope to one account (folder filters apply). Omit `userId` for all users (global gallery).
 */
export async function listProjectsSummary(
  db: SupabaseClient,
  options: {
    userId?: string;
    limit?: number;
    offset?: number;
    folder?: ProjectFolderFilter;
    /** When listing globally (`userId` omitted), optionally restrict to one owner */
    filterOwnerUserId?: string | null;
  }
): Promise<ProjectMetadata[]> {
  let query = db
    .from("projects")
    .select(
      "id,name,user_prompt,status,created_at,updated_at,completed_at,error,verification_status,model_id,generation_mode,folder_id,user_id,owner_username,cover_image_status"
    )
    .order("created_at", { ascending: false });

  if (options.userId) {
    query = query.eq("user_id", options.userId);
    const folder = options.folder ?? "all";
    if (folder === "uncategorized") {
      query = query.is("folder_id", null);
    } else if (folder !== "all") {
      query = query.eq("folder_id", folder);
    }
  } else if (options.filterOwnerUserId) {
    query = query.eq("user_id", options.filterOwnerUserId);
  }

  if (
    typeof options.limit === "number" &&
    Number.isFinite(options.limit) &&
    options.limit > 0
  ) {
    const offset =
      typeof options.offset === "number" &&
      Number.isFinite(options.offset) &&
      options.offset >= 0
        ? options.offset
        : 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[projectManager] listProjectsSummary error:", error.message);
    return [];
  }

  return (data as ProjectListRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    userPrompt: row.user_prompt,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    verificationStatus: row.verification_status ?? undefined,
    modelId: row.model_id ?? undefined,
    generationMode: coerceGenerationMode(row.generation_mode),
    folderId: row.folder_id ?? undefined,
    modificationHistory: [],
    ownerUserId: row.user_id ?? undefined,
    ownerUsername: row.owner_username ?? undefined,
    coverImageStatus: row.cover_image_status ?? undefined,
  }));
}

/**
 * Returns distinct owners for global gallery member filter.
 * Scans recent project rows in batches and deduplicates by `user_id`.
 */
export async function listProjectOwnerOptions(
  db: SupabaseClient,
  options?: {
    maxOwners?: number;
    scanBatchSize?: number;
    maxScanRows?: number;
  }
): Promise<ProjectOwnerOption[]> {
  const maxOwners =
    typeof options?.maxOwners === "number" && Number.isFinite(options.maxOwners) && options.maxOwners > 0
      ? Math.floor(options.maxOwners)
      : 300;
  const scanBatchSize =
    typeof options?.scanBatchSize === "number" &&
    Number.isFinite(options.scanBatchSize) &&
    options.scanBatchSize > 0
      ? Math.floor(options.scanBatchSize)
      : 300;
  const maxScanRows =
    typeof options?.maxScanRows === "number" &&
    Number.isFinite(options.maxScanRows) &&
    options.maxScanRows > 0
      ? Math.floor(options.maxScanRows)
      : 6000;

  const dedup = new Map<string, string>();
  let offset = 0;

  while (offset < maxScanRows && dedup.size < maxOwners) {
    const { data, error } = await db
      .from("projects")
      .select("user_id,owner_username,created_at")
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + scanBatchSize - 1);

    if (error) {
      console.error("[projectManager] listProjectOwnerOptions error:", error.message);
      break;
    }

    const rows = (data ?? []) as ProjectOwnerRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const userId = row.user_id;
      if (!userId || dedup.has(userId)) continue;
      const label = row.owner_username?.trim() || `${userId.slice(0, 8)}…`;
      dedup.set(userId, label);
      if (dedup.size >= maxOwners) break;
    }

    if (rows.length < scanBatchSize) break;
    offset += rows.length;
  }

  return [...dedup.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

export async function getProject(db: SupabaseClient, id: string): Promise<ProjectMetadata | null> {
  const { data, error } = await db.from("projects").select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToMetadata(data as ProjectRow);
}

export async function createProject(
  db: SupabaseClient,
  args: {
    userPrompt: string;
    userId: string;
    ownerUsername: string;
    modelId?: string;
    folderId?: string | null;
    generationMode?: GenerationMode;
  }
): Promise<ProjectMetadata> {
  const {
    userPrompt,
    userId,
    ownerUsername,
    modelId,
    folderId,
    generationMode = "web",
  } = args;
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace(/\./g, "-");
  const promptTrimmed = userPrompt.trim();
  const displayName =
    promptTrimmed.length > 0
      ? clampProjectListName(promptTrimmed.replace(/\s+/g, " ")) || "未命名项目"
      : "未命名项目";

  const latinSlug = promptTrimmed
    .slice(0, 200)
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 8)
    .join(" ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slugSegment = latinSlug.length >= 2 ? latinSlug.slice(0, 80) : "project";
  const id = `${timestamp}_${slugSegment}`;
  const createdAt = now.toISOString();
  const row = {
    id,
    name: displayName,
    user_prompt: userPrompt,
    status: "generating" as const,
    created_at: createdAt,
    updated_at: createdAt,
    model_id: modelId ?? null,
    generation_mode: generationMode,
    user_id: userId,
    owner_username: ownerUsername,
    folder_id: folderId ?? null,
    modification_history: [],
  };
  const { data, error } = await db.from("projects").insert(row).select().single();
  if (error || !data) {
    throw new Error(`[projectManager] createProject failed: ${error?.message}`);
  }
  return rowToMetadata(data as ProjectRow);
}

export async function updateProjectStatus(
  db: SupabaseClient,
  id: string,
  status: ProjectMetadata["status"],
  extra?: Partial<ProjectMetadata>
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra) {
    if (extra.completedAt !== undefined) update.completed_at = extra.completedAt;
    if (extra.error !== undefined) update.error = extra.error;
    if (extra.verificationStatus !== undefined) update.verification_status = extra.verificationStatus;
    if (extra.blueprint !== undefined) update.blueprint = extra.blueprint;
    if (extra.buildSteps !== undefined) update.build_steps = extra.buildSteps;
    if (extra.generatedFiles !== undefined) update.generated_files = extra.generatedFiles;
    if (extra.logDirectory !== undefined) update.log_directory = extra.logDirectory;
    if (extra.totalDuration !== undefined) update.total_duration = extra.totalDuration;
    if (extra.modificationHistory !== undefined) update.modification_history = extra.modificationHistory;
    if (extra.currentGenerationRunId !== undefined)
      update.current_generation_run_id = extra.currentGenerationRunId;
  }
  const maxRetries = 2;
  let lastMessage = "";
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { error } = await db.from("projects").update(update).eq("id", id);
    if (!error) return;

    lastMessage = error.message ?? String(error);
    const lower = lastMessage.toLowerCase();
    const isRetryableNetworkError =
      lower.includes("fetch failed") ||
      lower.includes("network") ||
      lower.includes("socket") ||
      lower.includes("etimedout") ||
      lower.includes("econnreset");

    if (isRetryableNetworkError && attempt < maxRetries) {
      const delayMs = 300 * (attempt + 1);
      console.warn(
        `[projectManager] updateProjectStatus transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms: ${lastMessage}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    break;
  }

  throw new Error(`[projectManager] updateProjectStatus failed: ${lastMessage}`);
}

export async function updateProjectCoverState(
  db: SupabaseClient,
  id: string,
  patch: {
    status: ProjectCoverImageStatus;
    /** Relative path under project-files/{id}/ — e.g. `.open-ox-cover/cover.jpg` */
    storageRelativePath?: string | null;
    error?: string | null;
  }
): Promise<void> {
  const ts = new Date().toISOString();
  const update: Record<string, unknown> = {
    updated_at: ts,
    cover_image_status: patch.status,
    cover_image_updated_at: ts,
  };
  if (patch.storageRelativePath !== undefined) {
    update.cover_image_storage_path = patch.storageRelativePath;
  }
  if (patch.error !== undefined) {
    update.cover_image_error = patch.error;
  }
  const { error } = await db.from("projects").update(update).eq("id", id);
  if (error) {
    throw new Error(`[projectManager] updateProjectCoverState failed: ${error.message}`);
  }
}

export async function setProjectFolder(
  db: SupabaseClient,
  projectId: string,
  folderId: string | null
): Promise<void> {
  const { error } = await db
    .from("projects")
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new Error(`[projectManager] setProjectFolder failed: ${error.message}`);
}

export async function renameProject(db: SupabaseClient, id: string, name: string): Promise<void> {
  const safeName = clampProjectListName(name);
  const finalName = safeName.length > 0 ? safeName : "未命名项目";
  const { error } = await db
    .from("projects")
    .update({ name: finalName, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`[projectManager] renameProject failed: ${error.message}`);
}

export async function deleteProject(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw new Error(`[projectManager] deleteProject failed: ${error.message}`);
  const root = getSiteRoot(id);
  void fs.rm(root, { recursive: true, force: true }).catch((err) => {
    console.error(`[projectManager] deleteProject site dir cleanup failed id=${id}:`, err);
  });
}

const TEMPLATE_EXCLUDE = new Set([
  "components/sections",
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "design-system.md",
  ".git",
  ".next",
  "node_modules",
  "pnpm-lock.yaml",
  "tsconfig.tsbuildinfo",
]);

/**
 * Minimal `app/layout.tsx` written into a fresh project directory. It does NOT
 * import any chrome components — the Architect Agent will overwrite this file
 * with the project's real chrome. Having a valid baseline here means the
 * Architect Agent's pre-read of `app/layout.tsx` always shows the new
 * project's own file (never `sites/template/app/layout.tsx`, which historically
 * contained references to long-removed `layout_NavigationSection` etc.).
 */
const DEFAULT_ROOT_LAYOUT_TSX = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "New Project",
  description: "Generated by open-ox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;

async function writeDefaultRootLayout(projectDir: string): Promise<void> {
  const appDir = path.join(projectDir, "app");
  await fs.mkdir(appDir, { recursive: true });
  await fs.writeFile(path.join(appDir, "layout.tsx"), DEFAULT_ROOT_LAYOUT_TSX, "utf-8");
}

async function copyTemplateDir(src: string, dest: string, templateRoot: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries: Dirent[] = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.relative(templateRoot, path.join(src, entry.name));
    const relPathNorm = relPath.split(path.sep).join("/");
    const excluded = [...TEMPLATE_EXCLUDE].some(
      (ex) => relPathNorm === ex || relPathNorm.startsWith(ex + "/")
    );
    if (excluded) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTemplateDir(srcPath, destPath, templateRoot);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function initProjectDir(db: SupabaseClient, projectId: string): Promise<void> {
  const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
  const projectDir = getSiteRoot(projectId);

  try {
    await fs.access(templateDir);
  } catch {
    await updateProjectStatus(db, projectId, "failed", {
      error: `Template directory not found: ${templateDir}`,
    });
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  try {
    await copyTemplateDir(templateDir, projectDir, templateDir);

    const pkgPath = path.join(projectDir, "package.json");
    const nextConfigPath = path.join(projectDir, "next.config.ts");
    for (const requiredFile of [pkgPath, nextConfigPath]) {
      try {
        await fs.access(requiredFile);
      } catch {
        throw new Error(
          `Required file missing after template copy: ${path.relative(projectDir, requiredFile)}`
        );
      }
    }

    const projPkg = JSON.parse(await fs.readFile(pkgPath, "utf-8")) as {
      name?: string;
      [key: string]: unknown;
    };
    projPkg.name = projectId;
    await fs.writeFile(pkgPath, JSON.stringify(projPkg, null, 2) + "\n", "utf-8");

    await writeDefaultRootLayout(projectDir);

    await ensureProjectNodeModules(projectDir);
  } catch (err: unknown) {
    await fs.rm(projectDir, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : String(err);
    await updateProjectStatus(db, projectId, "failed", { error: message });
    throw err;
  }
}
