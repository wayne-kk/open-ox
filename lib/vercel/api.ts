import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  formatVercelCreateProjectError,
  isVercelCreateProjectPermissionError,
  teamIdCandidatesForCreateWithFallback,
} from "./createProjectPermission";

export {
  coerceStoredProductionUrl,
  productionUrlFromDeployment,
} from "./productionUrl";

function teamQuery(teamId: string | null | undefined): string {
  if (!teamId?.trim()) return "";
  return `?teamId=${encodeURIComponent(teamId.trim())}`;
}

async function vercelFetch<T>(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const errObj = json as { error?: { message?: string }; message?: string };
    const msg =
      errObj?.error?.message ?? errObj?.message ?? text.slice(0, 400) ?? `HTTP ${res.status}`;
    throw new Error(`Vercel API ${res.status}: ${msg}`);
  }
  return json as T;
}

export type CreatedVercelProject = {
  id: string;
  name: string;
  /** Team scope that succeeded (null = personal account). */
  teamId: string | null;
};

async function postCreateVercelProject(params: {
  accessToken: string;
  teamId: string | null;
  name: string;
}): Promise<CreatedVercelProject> {
  const q = teamQuery(params.teamId);
  const json = await vercelFetch<{ id: string; name: string }>(
    params.accessToken,
    `https://api.vercel.com/v11/projects${q}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name,
        framework: null,
      }),
    }
  );
  return { id: json.id, name: json.name, teamId: params.teamId };
}

/**
 * Create a Vercel project under the Integration install scope.
 * Retries alternate teamId when Vercel returns the classic create-permission 403
 * (usually a drifted "default Team" vs installation team).
 */
export async function createVercelProject(params: {
  accessToken: string;
  teamId: string | null;
  /** Team id from OAuth token / configuration — preferred over drifted stored default. */
  installationTeamId?: string | null;
  name: string;
}): Promise<CreatedVercelProject> {
  const candidates = teamIdCandidatesForCreateWithFallback(
    params.teamId,
    params.installationTeamId ?? null
  );
  let lastErr: unknown;
  for (const teamId of candidates) {
    try {
      return await postCreateVercelProject({
        accessToken: params.accessToken,
        teamId,
        name: params.name,
      });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isVercelCreateProjectPermissionError(msg)) {
        throw err instanceof Error ? err : new Error(msg);
      }
    }
  }
  const raw = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(formatVercelCreateProjectError(raw));
}

/** Resolve the team the Integration was installed on (token scope). */
export async function fetchVercelInstallationTeamId(params: {
  accessToken: string;
  configurationId: string | null;
}): Promise<string | null> {
  const id = params.configurationId?.trim();
  if (!id) return null;
  try {
    const json = await vercelFetch<{ teamId?: string | null }>(
      params.accessToken,
      `https://api.vercel.com/v1/integrations/configuration/${encodeURIComponent(id)}`
    );
    return json.teamId?.trim() ? json.teamId.trim() : null;
  } catch {
    return null;
  }
}

export type UploadedFileRef = {
  file: string;
  sha: string;
  size: number;
};

async function walkFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(full, base)));
    } else if (ent.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out;
}

export async function uploadStaticDirToVercel(params: {
  accessToken: string;
  teamId: string | null;
  outDir: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<UploadedFileRef[]> {
  const relPaths = await walkFiles(params.outDir, params.outDir);
  if (relPaths.length === 0) {
    throw new Error("Static export out/ is empty");
  }
  const refs: UploadedFileRef[] = [];
  const q = teamQuery(params.teamId);
  let done = 0;
  for (const rel of relPaths) {
    const full = path.join(params.outDir, rel);
    const buf = await fs.readFile(full);
    const sha = createHash("sha1").update(buf).digest("hex");
    const uploadRes = await fetch(`https://api.vercel.com/v2/files${q}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buf.byteLength),
        "x-vercel-digest": sha,
      },
      body: buf,
    });
    if (!uploadRes.ok && uploadRes.status !== 200) {
      // 409 = already uploaded with this digest — fine
      if (uploadRes.status !== 409) {
        const t = await uploadRes.text();
        throw new Error(`File upload failed for ${rel}: ${uploadRes.status} ${t.slice(0, 300)}`);
      }
    }
    refs.push({ file: rel, sha, size: buf.byteLength });
    done += 1;
    params.onProgress?.(done, relPaths.length);
  }
  return refs;
}

export type VercelDeployment = {
  id: string;
  url?: string;
  readyState?: string;
  aliasAssigned?: boolean | string | number | null;
  alias?: string[];
};

function aliasAssignedReady(d: VercelDeployment): boolean {
  const a = d.aliasAssigned;
  if (a === true) return true;
  if (typeof a === "number" && a > 0) return true;
  if (typeof a === "string" && a.trim() && a !== "false") return true;
  return Array.isArray(d.alias) && d.alias.length > 0;
}

export async function createVercelDeployment(params: {
  accessToken: string;
  teamId: string | null;
  name: string;
  projectId: string;
  files: UploadedFileRef[];
}): Promise<VercelDeployment> {
  const q = teamQuery(params.teamId);
  return vercelFetch<VercelDeployment>(
    params.accessToken,
    `https://api.vercel.com/v13/deployments${q}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name,
        project: params.projectId,
        target: "production",
        files: params.files,
        projectSettings: {
          framework: null,
        },
      }),
    }
  );
}

export async function getVercelDeployment(params: {
  accessToken: string;
  teamId: string | null;
  deploymentId: string;
}): Promise<VercelDeployment> {
  const q = teamQuery(params.teamId);
  return vercelFetch<VercelDeployment>(
    params.accessToken,
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(params.deploymentId)}${q}`
  );
}

export async function listVercelDeploymentAliases(params: {
  accessToken: string;
  teamId: string | null;
  deploymentId: string;
}): Promise<string[]> {
  const q = teamQuery(params.teamId);
  try {
    const json = await vercelFetch<{ aliases?: Array<{ alias?: string }> }>(
      params.accessToken,
      `https://api.vercel.com/v2/deployments/${encodeURIComponent(params.deploymentId)}/aliases${q}`
    );
    return (json.aliases ?? [])
      .map((a) => a.alias?.trim())
      .filter((a): a is string => Boolean(a));
  } catch {
    return [];
  }
}

export async function waitForVercelDeploymentReady(params: {
  accessToken: string;
  teamId: string | null;
  deploymentId: string;
  timeoutMs?: number;
  pollMs?: number;
  /** Extra wait after READY for production aliases (default 20s). */
  aliasGraceMs?: number;
}): Promise<VercelDeployment> {
  const timeoutMs = params.timeoutMs ?? 180_000;
  const pollMs = params.pollMs ?? 2_000;
  const aliasGraceMs = params.aliasGraceMs ?? 20_000;
  const start = Date.now();
  let readyAt: number | null = null;
  for (;;) {
    const d = await getVercelDeployment({
      accessToken: params.accessToken,
      teamId: params.teamId,
      deploymentId: params.deploymentId,
    });
    const state = (d.readyState ?? "").toUpperCase();
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel deployment ${state}`);
    }
    if (state === "READY") {
      if (aliasAssignedReady(d)) return d;
      if (readyAt == null) readyAt = Date.now();
      if (Date.now() - readyAt >= aliasGraceMs) return d;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Vercel deployment (last state=${state || "unknown"})`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

