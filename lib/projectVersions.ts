import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeProjectFingerprint } from "@/lib/previewShared";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildCurrentProjectSnapshotZip,
  deleteProjectStorageObject,
  downloadProjectStorageBuffer,
  ensureProjectSourcesOnDisk,
  uploadProjectFileContent,
} from "@/lib/storage";

export type ProjectVersionSourceKind =
  | "generate"
  | "modify"
  | "design_mode"
  | "manual"
  | "deploy";

export type ProjectVersion = {
  id: string;
  projectId: string;
  versionNumber: number;
  sourceFingerprint: string;
  snapshotStoragePath: string;
  sourceKind: ProjectVersionSourceKind;
  summary: string | null;
  verificationStatus: "passed" | "failed" | "unknown";
  createdAt: string;
};

type ProjectVersionRow = {
  id: string;
  project_id: string;
  version_number: number;
  source_fingerprint: string;
  snapshot_storage_path: string;
  source_kind: ProjectVersionSourceKind;
  summary: string | null;
  verification_status: "passed" | "failed" | "unknown" | null;
  created_at: string;
};

function rowToVersion(row: ProjectVersionRow): ProjectVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    sourceFingerprint: row.source_fingerprint,
    snapshotStoragePath: row.snapshot_storage_path,
    sourceKind: row.source_kind,
    summary: row.summary,
    verificationStatus: row.verification_status ?? "unknown",
    createdAt: row.created_at,
  };
}

function admin(): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

export async function markProjectVersionCapturePending(projectId: string): Promise<void> {
  const { error } = await admin()
    .from("projects")
    .update({ version_capture_pending: true })
    .eq("id", projectId);
  if (error) throw new Error(`[projectVersions] mark pending failed: ${error.message}`);
}

export async function listProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const { data, error } = await admin()
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`[projectVersions] list failed: ${error.message}`);
  return ((data ?? []) as ProjectVersionRow[]).map(rowToVersion);
}

export async function listProjectVersionsForProjects(
  projectIds: string[]
): Promise<Map<string, ProjectVersion[]>> {
  const unique = [...new Set(projectIds.filter(Boolean))];
  const grouped = new Map<string, ProjectVersion[]>();
  if (unique.length === 0) return grouped;
  const { data, error } = await admin()
    .from("project_versions")
    .select("*")
    .in("project_id", unique)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`[projectVersions] batch list failed: ${error.message}`);
  for (const row of (data ?? []) as ProjectVersionRow[]) {
    const version = rowToVersion(row);
    const versions = grouped.get(version.projectId) ?? [];
    versions.push(version);
    grouped.set(version.projectId, versions);
  }
  return grouped;
}

export async function getProjectVersion(
  projectId: string,
  versionId: string
): Promise<ProjectVersion | null> {
  const { data, error } = await admin()
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`[projectVersions] get failed: ${error.message}`);
  return data ? rowToVersion(data as ProjectVersionRow) : null;
}

export async function getCurrentProjectVersion(projectId: string): Promise<ProjectVersion | null> {
  const versions = await listProjectVersions(projectId);
  return versions[0] ?? null;
}

export async function captureProjectVersion(
  projectId: string,
  input: {
    sourceKind: ProjectVersionSourceKind;
    summary?: string | null;
    verificationStatus?: "passed" | "failed" | "unknown";
  }
): Promise<ProjectVersion> {
  const db = admin();
  // A warm server instance may have an older workspace. Supplying DB enables
  // fingerprint comparison and restoration from the canonical uploaded snapshot.
  await ensureProjectSourcesOnDisk(projectId, { db });
  let sourceFingerprint = "";
  let zip: Buffer | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    sourceFingerprint = await computeProjectFingerprint(projectId);
    const { data: existing, error: existingError } = await db
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .eq("source_fingerprint", sourceFingerprint)
      .maybeSingle();
    if (existingError) throw new Error(`[projectVersions] lookup failed: ${existingError.message}`);
    if (existing) {
      const { data, error } = await db.rpc("register_project_version", {
        p_id: existing.id,
        p_project_id: projectId,
        p_source_fingerprint: sourceFingerprint,
        p_snapshot_storage_path: existing.snapshot_storage_path,
        p_source_kind: existing.source_kind,
        p_summary: existing.summary,
        p_verification_status: existing.verification_status ?? "unknown",
      });
      if (error || !data) {
        throw new Error(`[projectVersions] confirm existing failed: ${error?.message ?? "empty result"}`);
      }
      return rowToVersion(existing as ProjectVersionRow);
    }

    const candidate = await buildCurrentProjectSnapshotZip(projectId);
    const afterFingerprint = await computeProjectFingerprint(projectId);
    if (afterFingerprint === sourceFingerprint) {
      zip = candidate;
      break;
    }
  }
  if (!zip) throw new Error("[projectVersions] source changed while capturing snapshot");

  const id = randomUUID();
  const snapshotStoragePath = `${projectId}/.open-ox/versions/${id}.zip`;
  await uploadProjectFileContent(
    projectId,
    `.open-ox/versions/${id}.zip`,
    zip,
    { contentType: "application/zip" }
  );

  const { data, error } = await db.rpc("register_project_version", {
      p_id: id,
      p_project_id: projectId,
      p_source_fingerprint: sourceFingerprint,
      p_snapshot_storage_path: snapshotStoragePath,
      p_source_kind: input.sourceKind,
      p_summary: input.summary?.trim() || null,
      p_verification_status: input.verificationStatus ?? "unknown",
    });
  if (error || !data) {
    await deleteProjectStorageObject(snapshotStoragePath).catch((cleanupError) => {
      console.error("[projectVersions] failed to clean unregistered snapshot:", cleanupError);
    });
    throw new Error(`[projectVersions] register failed: ${error?.message ?? "empty result"}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as ProjectVersionRow;
  if (row.id !== id) {
    await deleteProjectStorageObject(snapshotStoragePath).catch((cleanupError) => {
      console.error("[projectVersions] failed to clean duplicate snapshot:", cleanupError);
    });
  }
  return rowToVersion(row);
}

function safeZipEntry(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  return Boolean(normalized) && !normalized.startsWith("/") && !normalized.split("/").includes("..");
}

/** Materialize an immutable version in an isolated directory. Caller removes `root`. */
export async function materializeProjectVersion(version: ProjectVersion): Promise<{
  root: string;
  projectDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "open-ox-version-"));
  const projectDir = path.join(root, "project");
  await fs.mkdir(projectDir, { recursive: true });
  try {
    const buffer = await downloadProjectStorageBuffer(version.snapshotStoragePath);
    const zip = new AdmZip(buffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !safeZipEntry(entry.entryName)) continue;
      const output = path.join(projectDir, ...entry.entryName.replace(/\\/g, "/").split("/"));
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, entry.getData());
    }
    return { root, projectDir };
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true });
    throw error;
  }
}
