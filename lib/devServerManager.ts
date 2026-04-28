/**
 * Dev Server Manager — static export preview
 *
 * Default: local `next build` + `npx serve` (see `localDevServerManager.ts`).
 * E2B: set `OPEN_OX_PREVIEW_BACKEND=e2b`. Flow in cloud:
 *   1. Check Supabase for existing sandboxId → try reconnect
 *   2. Create sandbox from custom template (large memory)
 *   3. Upload generated files + inject `output: 'export'` into next.config
 *   4. npm install (if node_modules missing)
 *   5. next build → static export to /home/user/app/out
 *   6. npx serve out -l 3000 (background) → fast static file serving
 *   7. Return sandbox.getHost(3000)
 */

import fs from "fs/promises";
import path from "path";
import { Sandbox } from "e2b";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as localPreview from "./localDevServerManager";
import { isPreviewE2B } from "./previewMode";
import { getSavedFingerprint, saveFingerprint } from "./previewFingerprintDb";
import {
  collectFiles,
  computeProjectFingerprint,
  PREVIEW_FALLBACK_FILES,
  TEMPLATE_BASE_FILE_NAMES,
  UPLOAD_EXCLUDE,
  ensureGlobalErrorFromTemplateForProject,
} from "./previewShared";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";
import { restoreProjectFiles } from "./storage";

export { classifyModificationScope, type PreviewRefreshMode } from "./previewShared";

/** Known deps baked into the E2B template — parsed from e2b-template/package.json at build time */
const TEMPLATE_PKG_PATH = path.join(WORKSPACE_ROOT, "e2b-template", "package.json");

const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;
const NEXTJS_TEMPLATE = "8e362hd4wmp7b8hev3do";
const SERVE_PORT = 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Run a command in the sandbox, returning the result even if the command exits
 * with a non-zero code. E2B SDK v2.18+ throws `CommandExitError` on non-zero
 * exit; this wrapper catches it and returns the embedded result so callers can
 * inspect `exitCode` / `stdout` without try/catch at every call site.
 */
async function safeRun(
  sandbox: Sandbox,
  cmd: string,
  opts?: Parameters<Sandbox["commands"]["run"]>[1]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await sandbox.commands.run(cmd, opts);
    return {
      exitCode: result.exitCode ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (err: unknown) {
    // CommandExitError carries the full result on the error object
    if (err && typeof err === "object" && "result" in err) {
      const r = (err as { result: { exitCode: number; stdout: string; stderr: string } }).result;
      return {
        exitCode: r.exitCode ?? 1,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      };
    }
    // Unknown error shape — rethrow
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSandboxId(db: SupabaseClient, projectId: string): Promise<string | null> {
  const { data } = await db
    .from("projects")
    .select("sandbox_id")
    .eq("id", projectId)
    .single();
  return (data as { sandbox_id: string | null } | null)?.sandbox_id ?? null;
}

async function saveSandboxId(db: SupabaseClient, projectId: string, sandboxId: string): Promise<void> {
  await db
    .from("projects")
    .update({ sandbox_id: sandboxId, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

async function clearSandboxId(db: SupabaseClient, projectId: string): Promise<void> {
  await db
    .from("projects")
    .update({ sandbox_id: null, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

function e2bOpts() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) throw new Error("E2B_API_KEY environment variable is not set");
  return { apiKey };
}

async function uploadProjectToSandbox(sandbox: Sandbox, projectId: string): Promise<void> {
  await ensureGlobalErrorFromTemplateForProject(projectId);
  const projectDir = getSiteRoot(projectId);
  const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
  const files = await collectFiles(projectDir, projectDir);
  console.log(`[e2b upload] Project dir: ${projectDir}`);
  console.log(`[e2b upload] Collected ${files.length} files from disk`);

  // Template base files that must always be present in the sandbox.
  // If the project dir is missing any (e.g. after a Storage restore that only
  // contains AI-generated files), fall back to the local template copy.
  const fileSet = new Set(files);
  for (const f of TEMPLATE_BASE_FILE_NAMES) {
    if (!fileSet.has(f)) files.push(f);
  }

  const BATCH = 20;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (relPath) => {
        // For package.json and template base files, prefer template copy
        const useTemplate = relPath === "package.json" || TEMPLATE_BASE_FILE_NAMES.includes(relPath);
        let localPath = path.join(projectDir, relPath);
        if (useTemplate) {
          const templatePath = path.join(templateDir, relPath);
          try {
            await fs.access(templatePath);
            localPath = templatePath;
          } catch { /* fallback to project copy */ }
        }
        const content = await fs.readFile(localPath);
        const sandboxPath = `/home/user/app/${relPath}`;
        const dir = sandboxPath.substring(0, sandboxPath.lastIndexOf("/"));
        await sandbox.files.makeDir(dir);
        await sandbox.files.write(sandboxPath, content.buffer as ArrayBuffer);
      })
    );
  }

  // Upload fallback files that are required by default app/layout imports.
  const uploaded = new Set(files);
  for (const fallback of PREVIEW_FALLBACK_FILES) {
    if (uploaded.has(fallback.path)) continue;
    const sandboxPath = `/home/user/app/${fallback.path}`;
    const dir = sandboxPath.substring(0, sandboxPath.lastIndexOf("/"));
    await sandbox.files.makeDir(dir);
    await sandbox.files.write(sandboxPath, fallback.content);
  }
}

/**
 * Inject `output: 'export'` into next.config.ts inside the sandbox
 * so `next build` produces a static /out directory.
 */
async function injectStaticExport(sandbox: Sandbox): Promise<void> {
  const configPath = "/home/user/app/next.config.ts";
  let content: string;
  try {
    content = await sandbox.files.read(configPath);
  } catch {
    // File missing — nothing to patch (template already has output: 'export')
    return;
  }
  if (content.includes("output:") || content.includes("output :")) {
    return; // already has output config
  }
  // Insert output: 'export' + images.unoptimized (required for static export)
  const patched = content.replace(
    /const nextConfig:\s*NextConfig\s*=\s*\{/,
    `const nextConfig: NextConfig = {\n  output: 'export',\n  images: { unoptimized: true },`
  );
  await sandbox.files.write(configPath, patched);
}

/**
 * Extract missing module names from Next.js / webpack build output.
 * Matches patterns like:
 *   Module not found: Can't resolve 'some-package'
 *   Module not found: Can't resolve '@scope/package'
 */
function extractMissingModules(buildOutput: string): string[] {
  const re = /Module not found.*?Can't resolve ['"]([^'"]+)['"]/gi;
  const modules = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(buildOutput)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    // Skip relative imports — those are code bugs, not missing packages
    if (raw.startsWith(".") || raw.startsWith("/")) continue;
    // Normalize: @scope/pkg/sub → @scope/pkg, pkg/sub → pkg
    const normalized = raw.startsWith("@")
      ? raw.split("/").slice(0, 2).join("/")
      : raw.split("/")[0];
    if (normalized) modules.add(normalized);
  }
  return Array.from(modules);
}

/**
 * Run `next build` with one automatic retry: if the first build fails with
 * module-not-found errors, install the missing packages and rebuild.
 */
async function buildWithAutoInstall(
  sandbox: Sandbox,
  label: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const buildCmd =
    "cd /home/user/app && NODE_OPTIONS='--max-old-space-size=512' npx next build 2>&1";

  const first = await safeRun(sandbox, buildCmd, { timeoutMs: 120_000 });
  if (first.exitCode === 0) return first;

  const missing = extractMissingModules(first.stdout + "\n" + first.stderr);
  if (missing.length === 0) return first; // not a missing-module error

  console.log(`[e2b ${label}] Build failed with missing modules: ${missing.join(", ")}. Auto-installing...`);
  const installResult = await safeRun(
    sandbox,
    `cd /home/user/app && npm install --legacy-peer-deps ${missing.join(" ")} 2>&1`,
    { timeoutMs: 120_000 }
  );
  if (installResult.exitCode !== 0) {
    console.warn(`[e2b ${label}] Auto-install failed: ${installResult.stdout.slice(-200)}`);
    return first; // return original build error
  }

  console.log(`[e2b ${label}] Retrying build after installing ${missing.join(", ")}...`);
  // Clean .next cache before retry so webpack picks up new modules
  await sandbox.commands.run("cd /home/user/app && rm -rf .next");
  return safeRun(sandbox, buildCmd, { timeoutMs: 120_000 });
}

/**
 * Compare project package.json with template package.json.
 * Returns a list of "pkg@version" strings for deps that are NOT in the template.
 * If node_modules is completely missing, returns null → full install needed.
 */
async function getMissingDeps(sandbox: Sandbox): Promise<string[] | null> {
  // If no node_modules at all, need full install
  const check = await safeRun(sandbox,
    "test -d /home/user/app/node_modules && echo EXISTS || echo MISSING"
  );
  if (check.stdout.trim() === "MISSING") return null;

  // Read template deps (local file — what's baked into the E2B image)
  let templateDeps: Record<string, string> = {};
  try {
    const raw = await fs.readFile(TEMPLATE_PKG_PATH, "utf-8");
    const pkg = JSON.parse(raw);
    templateDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    // Can't read template pkg → fall back to full install
    return null;
  }

  // Read project deps (inside sandbox)
  let projectDeps: Record<string, string> = {};
  try {
    const content = await sandbox.files.read("/home/user/app/package.json");
    const pkg = JSON.parse(content);
    projectDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return null;
  }

  // Find deps in project but not in template
  const missing: string[] = [];
  for (const [name, version] of Object.entries(projectDeps)) {
    if (!(name in templateDeps)) {
      missing.push(`${name}@${version}`);
    }
  }

  // Also verify dependencies that should already exist in node_modules.
  // A reused sandbox may have stale node_modules from an older template image.
  const expectedInTemplate = Object.keys(projectDeps).filter((name) => name in templateDeps);
  const PRESENCE_BATCH = 30;
  for (let i = 0; i < expectedInTemplate.length; i += PRESENCE_BATCH) {
    const batch = expectedInTemplate.slice(i, i + PRESENCE_BATCH);
    const checks = batch
      .map((name) => {
        const pkgPath = `/home/user/app/node_modules/${name}/package.json`;
        return `if [ ! -f '${pkgPath}' ]; then echo '${name}'; fi`;
      })
      .join("; ");
    const result = await safeRun(sandbox, checks);
    if (result.exitCode !== 0) continue;
    const actuallyMissing = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const depName of actuallyMissing) {
      const version = projectDeps[depName];
      if (!version) continue;
      const spec = `${depName}@${version}`;
      if (!missing.includes(spec)) {
        missing.push(spec);
      }
    }
  }

  return missing;
}

/**
 * Start a static file server on the built /out directory.
 * Waits for the server to be ready by listening to stdout.
 */
async function startServeAndWait(sandbox: Sandbox, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Static server did not start within ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const onOutput = (data: string) => {
      console.log("[e2b serve]", data.trim());
      // `serve` prints "Accepting connections at ..." when ready
      if (data.includes("Accepting connections") || data.includes("Listening on")) {
        clearTimeout(timer);
        resolve();
      }
    };

    sandbox.commands.run(
      `cd /home/user/app && npx serve out -l ${SERVE_PORT} --no-clipboard`,
      { background: true, onStdout: onOutput, onStderr: onOutput }
    ).catch((err: unknown) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Check if the static server is responding on the sandbox.
 */
async function isServerUp(sandbox: Sandbox): Promise<boolean> {
  const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(previewUrl, { signal: AbortSignal.timeout(5000) });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        if (i < attempts - 1) await sleep(800);
        continue;
      }
      const lowered = text.toLowerCase();
      const closedPort =
        lowered.includes("closed port error") ||
        lowered.includes("there's no service running on port 3000");
      if (!closedPort) return true;
    } catch {
      // ignore and retry
    }
    if (i < attempts - 1) await sleep(800);
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  if (!isPreviewE2B()) {
    return localPreview.startLocalDevServer(db, projectId);
  }
  return startE2BDevServer(db, projectId);
}

async function startE2BDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  const projectDir = getSiteRoot(projectId);
  console.log(`[devServerManager] Hydrating workspace for E2B preview: ${projectId}`);
  await restoreProjectFiles(projectId);
  try {
    await fs.access(path.join(projectDir, "package.json"));
  } catch {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  // Compute current file fingerprint
  const currentHash = await computeProjectFingerprint(projectId);
  const savedHash = await getSavedFingerprint(db, projectId);
  const filesChanged = currentHash !== savedHash;

  // 1. Try reconnecting to existing sandbox
  const existingSandboxId = await getSandboxId(db, projectId);
  if (existingSandboxId) {
    try {
      const sandbox = await Sandbox.connect(existingSandboxId, e2bOpts());
      const alive = await sandbox.isRunning();
      if (alive) {
        const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;

        // Fast path: files unchanged + server still running → return immediately
        if (!filesChanged && await isServerUp(sandbox)) {
          console.log("[e2b] Files unchanged, reusing existing preview");
          await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
          return { url: previewUrl, port: SERVE_PORT };
        }

        // Files unchanged but server down — just restart serve if /out exists
        if (!filesChanged) {
          const hasOut = await safeRun(sandbox, "test -d /home/user/app/out && echo YES || echo NO");
          if (hasOut.stdout.trim() === "YES") {
            console.log("[e2b] Files unchanged, restarting serve from existing /out");
            await sandbox.commands.run("pkill -f 'serve out' || true");
            await startServeAndWait(sandbox);
            if (!(await isServerUp(sandbox))) {
              throw new Error("serve restart reported ready but port 3000 is still unavailable");
            }
            await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
            return { url: previewUrl, port: SERVE_PORT };
          }
        }

        // Files changed — reuse sandbox but do full resync + rebuild
        console.log("[e2b] Files changed, rebuilding in existing sandbox");
        await sandbox.commands.run("pkill -f 'serve out' || true");
        await sandbox.commands.run("sleep 1 && ! pgrep -f 'serve out' || sleep 2");
        await sandbox.commands.run("cd /home/user/app && rm -rf .next out");
        await uploadProjectToSandbox(sandbox, projectId);
        await injectStaticExport(sandbox);

        const missingDeps = await getMissingDeps(sandbox);
        if (missingDeps === null) {
          const r = await safeRun(sandbox, "cd /home/user/app && npm install --legacy-peer-deps 2>&1", { timeoutMs: 120_000 });
          if (r.exitCode !== 0) throw new Error(`npm install failed: ${r.stdout.slice(-300)}`);
        } else if (missingDeps.length > 0) {
          const r = await safeRun(sandbox, `cd /home/user/app && npm install --legacy-peer-deps ${missingDeps.join(" ")} 2>&1`, { timeoutMs: 120_000 });
          if (r.exitCode !== 0) throw new Error(`npm install extras failed: ${r.stdout.slice(-300)}`);
        }

        const buildResult = await buildWithAutoInstall(sandbox, "reconnect");
        if (buildResult.exitCode !== 0) {
          throw new Error(`next build failed (exit ${buildResult.exitCode}): ${buildResult.stdout.slice(-500)}`);
        }

        await startServeAndWait(sandbox);
        if (!(await isServerUp(sandbox))) {
          throw new Error("serve restart reported ready but port 3000 is still unavailable");
        }
        await saveSandboxId(db, projectId, sandbox.sandboxId);
        await saveFingerprint(db, projectId, currentHash);
        await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
        return { url: previewUrl, port: SERVE_PORT };
      }
    } catch (err) {
      console.log("[e2b] Reconnect failed:", err instanceof Error ? err.message : err);
    }
    await clearSandboxId(db, projectId);
  }

  // 2. Create fresh sandbox
  console.log("[e2b] Creating sandbox...");
  const sandbox = await Sandbox.create(NEXTJS_TEMPLATE, {
    timeoutMs: SANDBOX_TIMEOUT_MS,
    metadata: { projectId },
    ...e2bOpts(),
  });

  try {
    // 3. Upload project files
    console.log("[e2b] Uploading project files...");
    await uploadProjectToSandbox(sandbox, projectId);

    // 4. Inject static export config
    await injectStaticExport(sandbox);

    // 5. Install deps
    const missingDeps = await getMissingDeps(sandbox);
    if (missingDeps === null) {
      console.log("[e2b] No node_modules found, running full npm install...");
      const installResult = await safeRun(sandbox,
        "cd /home/user/app && npm install --legacy-peer-deps 2>&1",
        { timeoutMs: 120_000 }
      );
      if (installResult.exitCode !== 0) {
        throw new Error(`npm install failed (exit ${installResult.exitCode}): ${installResult.stdout.slice(-500)}`);
      }
    } else if (missingDeps.length > 0) {
      console.log(`[e2b] Installing ${missingDeps.length} extra deps:`, missingDeps.join(", "));
      const installResult = await safeRun(sandbox,
        `cd /home/user/app && npm install --legacy-peer-deps ${missingDeps.join(" ")} 2>&1`,
        { timeoutMs: 120_000 }
      );
      if (installResult.exitCode !== 0) {
        throw new Error(`npm install (extras) failed (exit ${installResult.exitCode}): ${installResult.stdout.slice(-500)}`);
      }
    } else {
      console.log("[e2b] All deps already in template, skipping install");
    }

    // 6. Static build
    console.log("[e2b] Building static site...");
    const buildResult = await buildWithAutoInstall(sandbox, "fresh");
    console.log("[e2b] next build exit code:", buildResult.exitCode);
    if (buildResult.exitCode !== 0) {
      throw new Error(`next build failed (exit ${buildResult.exitCode}): ${buildResult.stdout.slice(-500)}`);
    }

    // 7. Start static file server
    console.log("[e2b] Starting static server...");
    await startServeAndWait(sandbox);
    if (!(await isServerUp(sandbox))) {
      throw new Error("serve startup reported ready but port 3000 is still unavailable");
    }

    const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
    await saveSandboxId(db, projectId, sandbox.sandboxId);
    await saveFingerprint(db, projectId, currentHash);
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
    return { url: previewUrl, port: SERVE_PORT };
  } catch (err) {
    await sandbox.kill().catch(() => { });
    throw err;
  }
}

export async function stopDevServer(db: SupabaseClient, projectId: string): Promise<void> {
  if (!isPreviewE2B()) {
    await localPreview.stopLocalDevServer(projectId);
    return;
  }
  const sandboxId = await getSandboxId(db, projectId);
  if (sandboxId) {
    try { await Sandbox.kill(sandboxId, e2bOpts()); } catch { /* already dead */ }
    await clearSandboxId(db, projectId);
  }
}

/**
 * Upload only specific changed files to an existing sandbox (incremental).
 * Much faster than full uploadProjectToSandbox for small modifications.
 */
async function uploadFilesToSandbox(
  sandbox: Sandbox,
  projectId: string,
  relPaths: string[]
): Promise<void> {
  const projectDir = getSiteRoot(projectId);
  const BATCH = 20;
  for (let i = 0; i < relPaths.length; i += BATCH) {
    const batch = relPaths.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (relPath) => {
        const localPath = path.join(projectDir, relPath);
        try {
          const content = await fs.readFile(localPath);
          const sandboxPath = `/home/user/app/${relPath}`;
          const dir = sandboxPath.substring(0, sandboxPath.lastIndexOf("/"));
          await sandbox.files.makeDir(dir);
          await sandbox.files.write(sandboxPath, content.buffer as ArrayBuffer);
        } catch {
          // File may have been deleted — skip
        }
      })
    );
  }
}

/**
 * Hot-refresh: upload changed files to sandbox and trigger browser reload.
 * No `next build` — just file swap + serve restart.
 * Only works for cosmetic changes (text, CSS, className).
 */
export async function hotRefreshDevServer(
  db: SupabaseClient,
  projectId: string,
  changedFiles: string[]
): Promise<{ url: string; port: number; mode: "hot" }> {
  if (!isPreviewE2B()) {
    return localPreview.hotRefreshLocalDevServer(db, projectId, changedFiles);
  }
  const sandboxId = await getSandboxId(db, projectId);
  if (!sandboxId) {
    // No sandbox — fall back to full start
    const result = await startDevServer(db, projectId);
    return { ...result, mode: "hot" };
  }

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.connect(sandboxId, e2bOpts());
    if (!(await sandbox.isRunning())) throw new Error("not running");
  } catch {
    await clearSandboxId(db, projectId);
    const result = await startDevServer(db, projectId);
    return { ...result, mode: "hot" };
  }

  await ensureGlobalErrorFromTemplateForProject(projectId);
  const changedWithGlobal = Array.from(new Set([...changedFiles, "app/global-error.tsx"]));
  console.log(
    `[e2b hot] Uploading ${changedWithGlobal.length} file(s) to sandbox ${sandboxId} (includes stable global-error)`
  );

  await uploadFilesToSandbox(sandbox, projectId, changedWithGlobal);

  // For static export, we need to rebuild even for hot refresh
  // But we can skip dependency installation since no imports changed
  console.log("[e2b hot] Rebuilding static site (no dep install)...");

  // Kill existing serve and clean stale build cache
  await sandbox.commands.run("pkill -f 'serve out' || true");
  await sandbox.commands.run("sleep 1 && ! pgrep -f 'serve out' || sleep 2");
  await sandbox.commands.run("cd /home/user/app && rm -rf .next out");

  // Rebuild
  const buildResult = await buildWithAutoInstall(sandbox, "hot");

  if (buildResult.exitCode !== 0) {
    // Hot refresh failed — fall back to full rebuild
    console.warn("[e2b hot] Build failed, falling back to full rebuild");
    const result = await rebuildDevServer(db, projectId);
    return { ...result, mode: "hot" };
  }

  // Restart serve
  await startServeAndWait(sandbox);

  const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
  await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
  return { url: previewUrl, port: SERVE_PORT, mode: "hot" };
}

/**
 * Resync files to existing sandbox, rebuild, and restart serve.
 * If no sandbox exists or reconnect fails, creates a fresh one (skipping
 * the reconnect-and-reuse shortcut in startDevServer that would serve stale content).
 */
export async function rebuildDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  if (!isPreviewE2B()) {
    return localPreview.rebuildLocalDevServer(db, projectId);
  }
  const sandboxId = await getSandboxId(db, projectId);

  let sandbox: Sandbox | null = null;

  if (sandboxId) {
    try {
      const candidate = await Sandbox.connect(sandboxId, e2bOpts());
      if (!(await candidate.isRunning())) throw new Error("not running");
      // Quick health check
      const healthCheck = await safeRun(candidate, "echo OK", { timeoutMs: 5_000 });
      if (healthCheck.exitCode !== 0 || !healthCheck.stdout.includes("OK")) {
        throw new Error("sandbox unhealthy");
      }
      sandbox = candidate;
    } catch {
      await clearSandboxId(db, projectId);
    }
  }

  // No usable sandbox — create a fresh one (do NOT call startDevServer which
  // has a reconnect shortcut that skips file upload and serves stale content).
  if (!sandbox) {
    console.log("[e2b rebuild] No usable sandbox, creating fresh one...");
    sandbox = await Sandbox.create(NEXTJS_TEMPLATE, {
      timeoutMs: SANDBOX_TIMEOUT_MS,
      metadata: { projectId },
      ...e2bOpts(),
    });
  }

  try {
    console.log("[e2b rebuild] Resyncing files to sandbox", sandbox.sandboxId);

    // 1. Kill existing serve process and wait for it to fully exit.
    // Without the wait, the old serve process may still hold memory when
    // next build starts, causing OOM on the first rebuild attempt.
    await sandbox.commands.run("pkill -f 'serve out' || true");
    await sandbox.commands.run("sleep 1 && ! pgrep -f 'serve out' || sleep 2");

    // 2. Clean stale build artifacts — .next cache can cause next build to
    //    serve old compiled output even after source files are updated.
    await sandbox.commands.run("cd /home/user/app && rm -rf .next out");

    // 3. Re-upload project files
    await uploadProjectToSandbox(sandbox, projectId);

    // 4. Inject static export config
    await injectStaticExport(sandbox);

    // 5. Install any new deps
    const missingDeps = await getMissingDeps(sandbox);
    if (missingDeps === null) {
      console.log("[e2b rebuild] Full npm install...");
      const r = await safeRun(sandbox, "cd /home/user/app && npm install --legacy-peer-deps 2>&1", { timeoutMs: 120_000 });
      if (r.exitCode !== 0) throw new Error(`npm install failed: ${r.stdout.slice(-300)}`);
    } else if (missingDeps.length > 0) {
      console.log(`[e2b rebuild] Installing ${missingDeps.length} extra deps`);
      const r = await safeRun(sandbox, `cd /home/user/app && npm install --legacy-peer-deps ${missingDeps.join(" ")} 2>&1`, { timeoutMs: 120_000 });
      if (r.exitCode !== 0) throw new Error(`npm install extras failed: ${r.stdout.slice(-300)}`);
    }

    // 6. Rebuild
    console.log("[e2b rebuild] Building...");
    const buildResult = await buildWithAutoInstall(sandbox, "rebuild");
    if (buildResult.exitCode !== 0) {
      const tail = buildResult.stdout.slice(-500);
      const signal = (buildResult as { signal?: string }).signal;
      if (signal) {
        throw new Error(`next build killed by ${signal} (likely OOM). Output: ${tail}`);
      }
      throw new Error(`next build failed (exit ${buildResult.exitCode}): ${tail}`);
    }

    // 7. Restart serve
    console.log("[e2b rebuild] Restarting serve...");
    await startServeAndWait(sandbox);

    const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
    await saveSandboxId(db, projectId, sandbox.sandboxId);
    // Save fingerprint so startDevServer knows files are in sync
    try {
      await saveFingerprint(db, projectId, await computeProjectFingerprint(projectId));
    } catch { /* non-fatal */ }
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
    return { url: previewUrl, port: SERVE_PORT };
  } catch (err) {
    // If we created a fresh sandbox and it failed, kill it
    if (!sandboxId || sandbox.sandboxId !== sandboxId) {
      await sandbox.kill().catch(() => { });
    }
    throw err;
  }
}

/**
 * Ensure the dev server is alive. If the sandbox is running but serve crashed,
 * restart serve from the existing /out directory. This is a lightweight health
 * check designed to be called when the user switches back to the Preview tab.
 *
 * Returns:
 *   - { status: "ok", url } — serve is responding (or was just restarted)
 *   - { status: "down" } — sandbox is gone or unrecoverable
 */
export async function ensureDevServerAlive(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "ok" | "down"; url?: string }> {
  if (!isPreviewE2B()) {
    return localPreview.ensureLocalDevServerAlive(db, projectId);
  }
  const sandboxId = await getSandboxId(db, projectId);
  if (!sandboxId) return { status: "down" };

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.connect(sandboxId, e2bOpts());
    if (!(await sandbox.isRunning())) {
      await clearSandboxId(db, projectId);
      return { status: "down" };
    }
  } catch {
    await clearSandboxId(db, projectId);
    return { status: "down" };
  }

  const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;

  // Fast path: serve is still responding
  if (await isServerUp(sandbox)) {
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
    return { status: "ok", url: previewUrl };
  }

  // Serve crashed but sandbox is alive — try restarting from existing /out
  console.log("[e2b ensureAlive] Serve is down, attempting restart...");
  const hasOut = await safeRun(sandbox,
    "test -d /home/user/app/out && echo YES || echo NO"
  );
  if (hasOut.stdout.trim() !== "YES") {
    // No /out directory — can't restart without a full rebuild
    console.log("[e2b ensureAlive] No /out directory, marking as down");
    return { status: "down" };
  }

  // Kill any zombie serve processes and restart
  await safeRun(sandbox, "pkill -f 'serve out' || true", { timeoutMs: 5_000 });
  await safeRun(sandbox, "sleep 1", { timeoutMs: 3_000 });

  try {
    await startServeAndWait(sandbox);
    if (await isServerUp(sandbox)) {
      console.log("[e2b ensureAlive] Serve restarted successfully");
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
      return { status: "ok", url: previewUrl };
    }
  } catch (err) {
    console.error("[e2b ensureAlive] Serve restart failed:", err);
  }

  return { status: "down" };
}

export async function getDevServerStatus(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  if (!isPreviewE2B()) {
    return localPreview.getLocalDevServerStatus(db, projectId);
  }
  const sandboxId = await getSandboxId(db, projectId);
  if (!sandboxId) return { status: "stopped" };
  try {
    const sandbox = await Sandbox.connect(sandboxId, e2bOpts());
    if (await sandbox.isRunning()) {
      const url = `https://${sandbox.getHost(SERVE_PORT)}`;
      if (await isServerUp(sandbox)) {
        return { status: "running", url };
      }
      return { status: "stopped" };
    }
  } catch { /* unreachable */ }
  await clearSandboxId(db, projectId);
  return { status: "stopped" };
}
