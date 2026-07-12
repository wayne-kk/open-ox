import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getProject } from "@/lib/projectManager";
import {
  createVercelDeployment,
  createVercelProject,
  productionUrlFromDeployment,
  uploadStaticDirToVercel,
  waitForVercelDeploymentReady,
} from "./api";
import { getVercelAccessToken } from "./connections";
import { vercelProjectNameForOpenOx } from "./oauth";
import { buildStaticExportForVercelDeploy } from "./staticExportForDeploy";

export type DeployStatus = "queued" | "building" | "uploading" | "ready" | "error";

export type ProjectDeployPublic = {
  status: DeployStatus;
  productionUrl: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  lastDeployId: string | null;
  lastError: string | null;
  lastDeployedAt: string | null;
  deployId: string | null;
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
};

const inFlight = new Map<string, Promise<void>>();

function admin(): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

function rowToPublic(row: DeployRow | null): ProjectDeployPublic {
  if (!row) {
    return {
      status: "queued",
      productionUrl: null,
      vercelProjectId: null,
      vercelProjectName: null,
      lastDeployId: null,
      lastError: null,
      lastDeployedAt: null,
      deployId: null,
    };
  }
  return {
    status: row.last_status,
    productionUrl: row.production_url,
    vercelProjectId: row.vercel_project_id,
    vercelProjectName: row.vercel_project_name,
    lastDeployId: row.last_deploy_id,
    lastError: row.last_error,
    lastDeployedAt: row.last_deployed_at,
    deployId: row.last_deploy_id,
  };
}

export async function getProjectDeployStatus(projectId: string): Promise<ProjectDeployPublic> {
  const { data, error } = await admin()
    .from("project_vercel_deployments")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    throw new Error(`[vercelDeploy] get status failed: ${error.message}`);
  }
  return rowToPublic((data as DeployRow | null) ?? null);
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
}): Promise<void> {
  const { projectId, userId, deployId } = params;
  try {
    const creds = await getVercelAccessToken(userId);
    if (!creds) {
      await patchDeploy(projectId, {
        last_status: "error",
        last_error: "Vercel not connected",
        last_deploy_id: deployId,
      });
      return;
    }

    await patchDeploy(projectId, {
      last_status: "building",
      last_error: null,
      last_deploy_id: deployId,
    });

    const { outDir } = await buildStaticExportForVercelDeploy(projectId);

    await patchDeploy(projectId, { last_status: "uploading" });

    const existing = await getProjectDeployStatus(projectId);
    let vercelProjectId = existing.vercelProjectId;
    let vercelProjectName = existing.vercelProjectName;

    const project = await getProject(admin(), projectId);
    const desiredName = vercelProjectNameForOpenOx(projectId, project?.name);

    if (!vercelProjectId) {
      const created = await createVercelProject({
        accessToken: creds.accessToken,
        teamId: creds.teamId,
        name: desiredName,
      });
      vercelProjectId = created.id;
      vercelProjectName = created.name;
      await patchDeploy(projectId, {
        vercel_project_id: vercelProjectId,
        vercel_project_name: vercelProjectName,
      });
    }

    const files = await uploadStaticDirToVercel({
      accessToken: creds.accessToken,
      teamId: creds.teamId,
      outDir,
    });

    const deployment = await createVercelDeployment({
      accessToken: creds.accessToken,
      teamId: creds.teamId,
      name: vercelProjectName ?? desiredName,
      projectId: vercelProjectId!,
      files,
    });

    const ready = await waitForVercelDeploymentReady({
      accessToken: creds.accessToken,
      teamId: creds.teamId,
      deploymentId: deployment.id,
    });

    const url = productionUrlFromDeployment(ready);
    await patchDeploy(projectId, {
      last_status: "ready",
      last_error: null,
      production_url: url,
      last_deploy_id: deployment.id,
      last_deployed_at: new Date().toISOString(),
      vercel_project_id: vercelProjectId,
      vercel_project_name: vercelProjectName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vercelDeploy] project=${projectId} failed:`, msg);
    await patchDeploy(projectId, {
      last_status: "error",
      last_error: msg.slice(0, 4000),
      last_deploy_id: deployId,
    }).catch((e) => {
      console.error("[vercelDeploy] failed to persist error:", e);
    });
  }
}

/**
 * Enqueue a deploy: persist queued row, return deployId, fire-and-forget worker.
 */
export async function enqueueProjectDeploy(params: {
  projectId: string;
  userId: string;
}): Promise<{ deployId: string }> {
  const existing = inFlight.get(params.projectId);
  if (existing) {
    const status = await getProjectDeployStatus(params.projectId);
    if (status.deployId && (status.status === "queued" || status.status === "building" || status.status === "uploading")) {
      return { deployId: status.deployId };
    }
  }

  const creds = await getVercelAccessToken(params.userId);
  if (!creds) {
    throw new Error("VERCEL_NOT_CONNECTED");
  }

  const deployId = `dpl_${randomBytes(12).toString("hex")}`;
  await patchDeploy(params.projectId, {
    last_status: "queued",
    last_error: null,
    last_deploy_id: deployId,
  });

  const promise = runDeployJob({
    projectId: params.projectId,
    userId: params.userId,
    deployId,
  }).finally(() => {
    inFlight.delete(params.projectId);
  });
  inFlight.set(params.projectId, promise);

  return { deployId };
}
