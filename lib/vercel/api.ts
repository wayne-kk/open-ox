import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

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
};

export async function createVercelProject(params: {
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
  return { id: json.id, name: json.name };
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
  aliasAssigned?: boolean | string | null;
};

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

export async function waitForVercelDeploymentReady(params: {
  accessToken: string;
  teamId: string | null;
  deploymentId: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<VercelDeployment> {
  const timeoutMs = params.timeoutMs ?? 180_000;
  const pollMs = params.pollMs ?? 2_000;
  const start = Date.now();
  for (;;) {
    const d = await getVercelDeployment({
      accessToken: params.accessToken,
      teamId: params.teamId,
      deploymentId: params.deploymentId,
    });
    const state = (d.readyState ?? "").toUpperCase();
    if (state === "READY") return d;
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel deployment ${state}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Vercel deployment (last state=${state || "unknown"})`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

export function productionUrlFromDeployment(d: VercelDeployment): string {
  if (d.url?.startsWith("http")) return d.url;
  if (d.url) return `https://${d.url}`;
  throw new Error("Deployment ready but missing url");
}
