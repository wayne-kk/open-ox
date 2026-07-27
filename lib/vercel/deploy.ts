import { randomBytes } from "crypto";
import fs from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getProject } from "@/lib/projectManager";
import {
  coerceStoredProductionUrl,
  createVercelDeployment,
  createVercelProject,
  fetchVercelInstallationTeamId,
  listVercelDeploymentAliases,
  productionUrlFromDeployment,
  uploadStaticDirToVercel,
  waitForVercelDeploymentReady,
} from "./api";
import { getVercelAccessToken, updateVercelDefaultTeam } from "./connections";
import { formatVercelCreateProjectError } from "./createProjectPermission";
import { vercelProjectNameForOpenOx } from "./oauth";
import { buildVersionStaticExportForVercelDeploy } from "./staticExportForDeploy";
import {
  captureProjectVersion,
  getProjectVersion,
  listProjectVersions,
  listProjectVersionsForProjects,
  materializeProjectVersion,
  type ProjectVersion,
} from "@/lib/projectVersions";
import { deploymentFreshness, type DeploymentFreshness } from "@/lib/projectVersionState";
import { removeProjectNodeModules } from "@/lib/ensureProjectNodeModules";
import { parseProjectsFilesHash } from "@/lib/previewFingerprintDb";
import {
  DEPLOY_IN_PROGRESS,
  publicDeployStatusFromRow,
  type DeployStatus,
} from "./deployStatus";

export type { DeployStatus } from "./deployStatus";

export type ProjectVersionPublic = Pick<
  ProjectVersion,
  "id" | "versionNumber" | "sourceKind" | "summary" | "verificationStatus" | "createdAt"
>;

export type ProjectDeployPublic = {
  status: DeployStatus | null;
  productionUrl: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  lastDeployId: string | null;
  lastError: string | null;
  lastDeployedAt: string | null;
  deployId: string | null;
  deployedVersionId: string | null;
  pendingVersionId: string | null;
  currentVersion: ProjectVersionPublic | null;
  deployedVersion: ProjectVersionPublic | null;
  versions: ProjectVersionPublic[];
  freshness: DeploymentFreshness;
  workingCopyHasChanges: boolean;
  versionCapturePending: boolean;
};

type DeployRow = {
  project_id: string;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  production_url: string | null;
  last_deploy_id: string | null;
  last_status: DeployStatus;
  last_error: string | null;
  last_deployed_at: string | null;
  updated_at: string;
  deployed_version_id: string | null;
  deployed_source_fingerprint: string | null;
  pending_version_id: string | null;
};

const inFlight = new Map<string, Promise<void>>();

function admin(): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

function rowToPublic(
  row: DeployRow | null,
  versions: ProjectVersion[],
  currentSourceFingerprint: string | null,
  versionCapturePending: boolean
): ProjectDeployPublic & { stale: boolean } {
  const resolved = publicDeployStatusFromRow(
    row
      ? {
          last_status: row.last_status,
          last_error: row.last_error,
          updated_at: row.updated_at,
        }
      : null
  );
  const lastError = resolved.lastError
    ? formatVercelCreateProjectError(resolved.lastError)
    : null;
  const currentVersion = versions[0] ?? null;
  const deployedVersion = row?.deployed_version_id
    ? versions.find((version) => version.id === row.deployed_version_id) ?? null
    : null;
  const productionUrl = row
    ? coerceStoredProductionUrl(row.production_url, row.vercel_project_name)
    : null;
  const workingCopyHasChanges = Boolean(
    versionCapturePending ||
    (currentSourceFingerprint && currentVersion?.sourceFingerprint !== currentSourceFingerprint)
  );
  const toPublicVersion = (version: ProjectVersion): ProjectVersionPublic => ({
    id: version.id,
    versionNumber: version.versionNumber,
    sourceKind: version.sourceKind,
    summary: version.summary,
    verificationStatus: version.verificationStatus,
    createdAt: version.createdAt,
  });
  const versionState = {
    deployedVersionId: row?.deployed_version_id ?? null,
    pendingVersionId: row?.pending_version_id ?? null,
    currentVersion: currentVersion ? toPublicVersion(currentVersion) : null,
    deployedVersion: deployedVersion ? toPublicVersion(deployedVersion) : null,
    versions: versions.map(toPublicVersion),
    workingCopyHasChanges,
    versionCapturePending,
    freshness: deploymentFreshness({
      productionUrl,
      currentVersionId: currentVersion?.id ?? null,
      deployedVersionId: row?.deployed_version_id ?? null,
      currentSourceFingerprint:
        currentSourceFingerprint ?? currentVersion?.sourceFingerprint ?? null,
      deployedSourceFingerprint: row?.deployed_source_fingerprint ?? null,
    }),
  };
  if (!row) {
    return {
      status: resolved.status,
      productionUrl: null,
      vercelProjectId: null,
      vercelProjectName: null,
      lastDeployId: null,
      lastError,
      lastDeployedAt: null,
      deployId: null,
      ...versionState,
      stale: resolved.stale,
    };
  }
  return {
    status: resolved.status,
    productionUrl,
    vercelProjectId: row.vercel_project_id,
    vercelProjectName: row.vercel_project_name,
    lastDeployId: row.last_deploy_id,
    lastError,
    lastDeployedAt: row.last_deployed_at,
    deployId: row.last_deploy_id,
    ...versionState,
    stale: resolved.stale,
  };
}

export async function getProjectDeployStatus(projectId: string): Promise<ProjectDeployPublic> {
  const [{ data, error }, versions, { data: projectData }] = await Promise.all([
    admin().from("project_vercel_deployments").select("*").eq("project_id", projectId).maybeSingle(),
    listProjectVersions(projectId),
    admin().from("projects").select("files_hash, version_capture_pending").eq("id", projectId).maybeSingle(),
  ]);
  if (error) {
    throw new Error(`[vercelDeploy] get status failed: ${error.message}`);
  }
  const row = (data as DeployRow | null) ?? null;
  const projectRow = projectData as {
    files_hash?: string | null;
    version_capture_pending?: boolean;
  } | null;
  const filesHash = projectRow?.files_hash ?? null;
  const currentSourceFingerprint = parseProjectsFilesHash(filesHash).filesFingerprint;
  const { stale, ...rest } = rowToPublic(
    row,
    versions,
    currentSourceFingerprint,
    projectRow?.version_capture_pending === true
  );
  if (stale && row) {
    // Persist so subsequent polls / other instances stop spinning too.
    await patchDeploy(projectId, {
      last_status: "error",
      last_error: rest.lastError,
    }).catch((e) => {
      console.error("[vercelDeploy] failed to persist stale timeout:", e);
    });
  }
  return rest;
}

export type UserDeployListItem = ProjectDeployPublic & {
  projectId: string;
  projectName: string;
};

const LIST_LIMIT = 100;

function deploySortKey(row: UserDeployListItem): number {
  const inProgress = row.status && DEPLOY_IN_PROGRESS.includes(row.status) ? 1 : 0;
  const hasUpdates = row.freshness === "updates_available" ? 1 : 0;
  const ts = row.lastDeployedAt ? Date.parse(row.lastDeployedAt) : 0;
  return inProgress * 1e15 + hasUpdates * 1e14 + ts;
}

/** Owner's deploy bindings for the Integrations & Deploy dashboard (latest per project). */
export async function listUserProjectDeployments(userId: string): Promise<UserDeployListItem[]> {
  const db = admin();
  const { data, error } = await db
    .from("project_vercel_deployments")
    .select(
      "project_id, vercel_project_id, vercel_project_name, production_url, last_deploy_id, last_status, last_error, last_deployed_at, updated_at, deployed_version_id, deployed_source_fingerprint, pending_version_id, projects!inner(id, name, user_id, files_hash, version_capture_pending)"
    )
    .eq("projects.user_id", userId)
    .limit(LIST_LIMIT);
  if (error) {
    throw new Error(`[vercelDeploy] list deployments failed: ${error.message}`);
  }

  type Joined = DeployRow & {
    projects: { id: string; name: string; user_id: string; files_hash: string | null; version_capture_pending: boolean } | { id: string; name: string; user_id: string; files_hash: string | null; version_capture_pending: boolean }[] | null;
  };

  const rows = (data ?? []) as unknown as Joined[];
  const versionsByProject = await listProjectVersionsForProjects(rows.map((row) => row.project_id));
  const items: UserDeployListItem[] = rows.map((row) => {
    const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    const projectName =
      (typeof proj?.name === "string" && proj.name.trim()) || row.project_id;
    const versions = versionsByProject.get(row.project_id) ?? [];
    const currentSourceFingerprint = parseProjectsFilesHash(proj?.files_hash ?? null).filesFingerprint;
    const { stale, ...pub } = rowToPublic(
      row,
      versions,
      currentSourceFingerprint,
      proj?.version_capture_pending === true
    );
    void stale;
    return {
      projectId: row.project_id,
      projectName,
      ...pub,
    };
  });

  items.sort((a, b) => deploySortKey(b) - deploySortKey(a));
  return items;
}

async function patchDeploy(
  projectId: string,
  patch: Partial<{
    vercel_project_id: string | null;
    vercel_project_name: string | null;
    production_url: string | null;
    last_deploy_id: string | null;
    last_status: DeployStatus;
    last_error: string | null;
    last_deployed_at: string | null;
    deployed_version_id: string | null;
    deployed_source_fingerprint: string | null;
    pending_version_id: string | null;
  }>
): Promise<void> {
  const db = admin();
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("project_vercel_deployments")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("project_vercel_deployments")
      .update({ ...patch, updated_at: now })
      .eq("project_id", projectId);
    if (error) {
      throw new Error(`[vercelDeploy] patch failed: ${error.message}`);
    }
    return;
  }

  const { error } = await db.from("project_vercel_deployments").insert({
    project_id: projectId,
    last_status: "queued",
    ...patch,
    updated_at: now,
  });
  if (error) {
    throw new Error(`[vercelDeploy] insert failed: ${error.message}`);
  }
}

async function runDeployJob(params: {
  projectId: string;
  userId: string;
  deployId: string;
  versionId: string;
}): Promise<void> {
  const { projectId, userId, deployId, versionId } = params;
  let materializedRoot: string | null = null;
  let materializedProjectDir: string | null = null;
  try {
    const creds = await getVercelAccessToken(userId);
    if (!creds) {
      await patchDeploy(projectId, {
        last_status: "error",
        last_error: "Vercel not connected",
        last_deploy_id: deployId,
        pending_version_id: null,
      });
      return;
    }

    await patchDeploy(projectId, {
      last_status: "building",
      last_error: null,
      last_deploy_id: deployId,
    });

    const version = await getProjectVersion(projectId, versionId);
    if (!version) throw new Error("PROJECT_VERSION_NOT_FOUND");
    const materialized = await materializeProjectVersion(version);
    materializedRoot = materialized.root;
    materializedProjectDir = materialized.projectDir;
    const { outDir, sourceFingerprint } = await buildVersionStaticExportForVercelDeploy({
      projectDir: materialized.projectDir,
      brandingProjectId: projectId,
    });
    if (sourceFingerprint !== version.sourceFingerprint) {
      throw new Error("PROJECT_VERSION_FINGERPRINT_MISMATCH");
    }

    await patchDeploy(projectId, { last_status: "uploading" });

    const existing = await getProjectDeployStatus(projectId);
    let vercelProjectId = existing.vercelProjectId;
    let vercelProjectName = existing.vercelProjectName;

    const project = await getProject(admin(), projectId);
    const desiredName = vercelProjectNameForOpenOx(projectId, project?.name);

    // Integration tokens are scoped to the install team. Heal drifted defaults
    // (e.g. user picked "个人账号" in settings while the install was on a Team).
    const installationTeamId = await fetchVercelInstallationTeamId({
      accessToken: creds.accessToken,
      configurationId: creds.configurationId,
    });
    let teamId = installationTeamId ?? creds.teamId;

    if (!vercelProjectId) {
      const created = await createVercelProject({
        accessToken: creds.accessToken,
        teamId,
        installationTeamId,
        name: desiredName,
      });
      vercelProjectId = created.id;
      vercelProjectName = created.name;
      teamId = created.teamId;
      if (created.teamId !== creds.teamId) {
        await updateVercelDefaultTeam({
          userId,
          teamId: created.teamId,
          teamName: created.teamId ? creds.teamName : null,
        }).catch((e) => {
          console.warn("[vercelDeploy] failed to persist healed team:", e);
        });
      }
      await patchDeploy(projectId, {
        vercel_project_id: vercelProjectId,
        vercel_project_name: vercelProjectName,
      });
    } else if (installationTeamId && installationTeamId !== creds.teamId) {
      teamId = installationTeamId;
    }

    const files = await uploadStaticDirToVercel({
      accessToken: creds.accessToken,
      teamId,
      outDir,
    });

    const deployment = await createVercelDeployment({
      accessToken: creds.accessToken,
      teamId,
      name: vercelProjectName ?? desiredName,
      projectId: vercelProjectId!,
      files,
    });

    const ready = await waitForVercelDeploymentReady({
      accessToken: creds.accessToken,
      teamId,
      deploymentId: deployment.id,
    });

    const listedAliases = await listVercelDeploymentAliases({
      accessToken: creds.accessToken,
      teamId,
      deploymentId: deployment.id,
    });
    const aliases = [...(ready.alias ?? []), ...listedAliases];
    const url = productionUrlFromDeployment(
      { url: ready.url, alias: aliases },
      { projectName: vercelProjectName }
    );
    await patchDeploy(projectId, {
      last_status: "ready",
      last_error: null,
      production_url: url,
      last_deploy_id: deployment.id,
      last_deployed_at: new Date().toISOString(),
      vercel_project_id: vercelProjectId,
      vercel_project_name: vercelProjectName,
      deployed_version_id: version.id,
      deployed_source_fingerprint: version.sourceFingerprint,
      pending_version_id: null,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = formatVercelCreateProjectError(raw);
    console.error(`[vercelDeploy] project=${projectId} failed:`, raw);
    await patchDeploy(projectId, {
      last_status: "error",
      last_error: msg.slice(0, 4000),
      last_deploy_id: deployId,
      pending_version_id: null,
    }).catch((e) => {
      console.error("[vercelDeploy] failed to persist error:", e);
    });
  } finally {
    if (materializedProjectDir) {
      await removeProjectNodeModules(materializedProjectDir);
    }
    if (materializedRoot) {
      await fs.rm(materializedRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * Enqueue a deploy: persist queued row, return deployId + job promise.
 * Callers must keep the job alive after the HTTP response (e.g. Next.js `after()`),
 * otherwise the worker dies while status stays stuck on "queued".
 */
export async function enqueueProjectDeploy(params: {
  projectId: string;
  userId: string;
  versionId?: string | null;
}): Promise<{ deployId: string; job: Promise<void> }> {
  const existing = inFlight.get(params.projectId);
  if (existing) {
    const status = await getProjectDeployStatus(params.projectId);
    if (
      status.deployId &&
      status.status &&
      DEPLOY_IN_PROGRESS.includes(status.status)
    ) {
      return { deployId: status.deployId, job: existing };
    }
  }

  const creds = await getVercelAccessToken(params.userId);
  if (!creds) {
    throw new Error("VERCEL_NOT_CONNECTED");
  }

  const version = params.versionId
    ? await getProjectVersion(params.projectId, params.versionId)
    : await captureProjectVersion(params.projectId, {
        sourceKind: "deploy",
        summary: "部署前保存",
      });
  if (!version) throw new Error("PROJECT_VERSION_NOT_FOUND");

  const deployId = `dpl_${randomBytes(12).toString("hex")}`;
  await patchDeploy(params.projectId, {
    last_status: "queued",
    last_error: null,
    last_deploy_id: deployId,
    pending_version_id: version.id,
  });

  const promise = runDeployJob({
    projectId: params.projectId,
    userId: params.userId,
    deployId,
    versionId: version.id,
  }).finally(() => {
    inFlight.delete(params.projectId);
  });
  inFlight.set(params.projectId, promise);

  return { deployId, job: promise };
}
