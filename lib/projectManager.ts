import fs from "fs/promises";
import path from "path";
import { Dirent } from "fs";
import { supabase } from "./supabase";

export const WORKSPACE_ROOT = process.cwd();

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
  error?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  userPrompt: string;
  status: "generating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  verificationStatus?: "passed" | "failed";
  blueprint?: unknown;
  buildSteps?: unknown[];
  generatedFiles?: string[];
  logDirectory?: string;
  modelId?: string;
  modificationHistory: ModificationRecord[];
}

interface ProjectRow {
  id: string;
  name: string;
  user_prompt: string;
  status: "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  verification_status: "passed" | "failed" | null;
  blueprint: unknown;
  build_steps: unknown[] | null;
  generated_files: string[] | null;
  log_directory: string | null;
  model_id: string | null;
  modification_history: ModificationRecord[];
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
    modelId: row.model_id ?? undefined,
    modificationHistory: row.modification_history ?? [],
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

export async function listProjects(): Promise<ProjectMetadata[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[projectManager] listProjects error:", error.message);
    return [];
  }
  return (data as ProjectRow[]).map(rowToMetadata);
}

export async function getProject(id: string): Promise<ProjectMetadata | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return rowToMetadata(data as ProjectRow);
}

export async function createProject(userPrompt: string, modelId?: string): Promise<ProjectMetadata> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace(/\./g, "-");
  const slug = userPrompt
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = `${timestamp}_${slug}`;
  const createdAt = now.toISOString();
  const row = {
    id,
    name: slug,
    user_prompt: userPrompt,
    status: "generating" as const,
    created_at: createdAt,
    updated_at: createdAt,
    model_id: modelId ?? null,
    modification_history: [],
  };
  const { data, error } = await supabase.from("projects").insert(row).select().single();
  if (error || !data) {
    throw new Error(`[projectManager] createProject failed: ${error?.message}`);
  }
  return rowToMetadata(data as ProjectRow);
}

export async function updateProjectStatus(
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
    if (extra.modificationHistory !== undefined) update.modification_history = extra.modificationHistory;
  }
  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) throw new Error(`[projectManager] updateProjectStatus failed: ${error.message}`);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`[projectManager] renameProject failed: ${error.message}`);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`[projectManager] deleteProject failed: ${error.message}`);
  await fs.rm(getSiteRoot(id), { recursive: true, force: true });
}

export async function addModificationRecord(
  id: string,
  record: ModificationRecord
): Promise<void> {
  const project = await getProject(id);
  if (!project) throw new Error(`Project not found: ${id}`);
  const history = [...(project.modificationHistory ?? []), record];
  const { error } = await supabase
    .from("projects")
    .update({ modification_history: history, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`[projectManager] addModificationRecord failed: ${error.message}`);
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

export async function initProjectDir(projectId: string): Promise<void> {
  const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
  const projectDir = getSiteRoot(projectId);

  try {
    await fs.access(templateDir);
  } catch {
    await updateProjectStatus(projectId, "failed", {
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

    const rootPkgRaw = await fs.readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf-8");
    const rootPkg = JSON.parse(rootPkgRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const sharedDeps = new Set([
      ...Object.keys(rootPkg.dependencies ?? {}),
      ...Object.keys(rootPkg.devDependencies ?? {}),
    ]);

    const projPkg = JSON.parse(await fs.readFile(pkgPath, "utf-8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      [key: string]: unknown;
    };
    projPkg.name = projectId;

    if (projPkg.dependencies) {
      for (const dep of Object.keys(projPkg.dependencies)) {
        if (sharedDeps.has(dep)) delete projPkg.dependencies[dep];
      }
      if (Object.keys(projPkg.dependencies).length === 0) delete projPkg.dependencies;
    }
    if (projPkg.devDependencies) {
      for (const dep of Object.keys(projPkg.devDependencies)) {
        if (sharedDeps.has(dep)) delete projPkg.devDependencies[dep];
      }
      if (Object.keys(projPkg.devDependencies).length === 0) delete projPkg.devDependencies;
    }

    await fs.writeFile(pkgPath, JSON.stringify(projPkg, null, 2) + "\n", "utf-8");

    const templateNodeModules = path.join(templateDir, "node_modules");
    const projectNodeModules = path.join(projectDir, "node_modules");
    try {
      await fs.access(templateNodeModules);
      await fs.symlink(templateNodeModules, projectNodeModules, "dir");
    } catch (symlinkErr: unknown) {
      console.warn(
        `[initProjectDir] Could not create node_modules symlink: ${symlinkErr instanceof Error ? symlinkErr.message : String(symlinkErr)}`
      );
    }
  } catch (err: unknown) {
    await fs.rm(projectDir, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : String(err);
    await updateProjectStatus(projectId, "failed", { error: message });
    throw err;
  }
}
