/**
 * Dev Server Manager — E2B Cloud Sandboxes (Static Build)
 *
 * Flow:
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
import { supabase } from "./supabase";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";
import { restoreProjectFiles } from "./storage";

/** Known deps baked into the E2B template — parsed from e2b-template/package.json at build time */
const TEMPLATE_PKG_PATH = path.join(WORKSPACE_ROOT, "e2b-template", "package.json");

const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;
const NEXTJS_TEMPLATE = "8e362hd4wmp7b8hev3do";
const SERVE_PORT = 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSandboxId(projectId: string): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select("sandbox_id")
    .eq("id", projectId)
    .single();
  return (data as { sandbox_id: string | null } | null)?.sandbox_id ?? null;
}

async function saveSandboxId(projectId: string, sandboxId: string): Promise<void> {
  await supabase
    .from("projects")
    .update({ sandbox_id: sandboxId, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

async function clearSandboxId(projectId: string): Promise<void> {
  await supabase
    .from("projects")
    .update({ sandbox_id: null, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

function e2bOpts() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) throw new Error("E2B_API_KEY environment variable is not set");
  return { apiKey };
}

const UPLOAD_EXCLUDE = new Set(["node_modules", ".next", ".git"]);

async function collectFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (UPLOAD_EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) continue;
        files.push(path.relative(base, full));
      } catch { /* broken symlink */ }
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function uploadProjectToSandbox(sandbox: Sandbox, projectId: string): Promise<void> {
  const projectDir = getSiteRoot(projectId);
  const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
  const files = await collectFiles(projectDir, projectDir);
  console.log(`[e2b upload] Project dir: ${projectDir}`);
  console.log(`[e2b upload] Collected ${files.length} files from disk`);

  // Template base files that must always be present in the sandbox.
  // If the project dir is missing any (e.g. after a Storage restore that only
  // contains AI-generated files), fall back to the local template copy.
  const TEMPLATE_BASE_FILES = [
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "eslint.config.mjs",
    "components.json",
  ];
  const fileSet = new Set(files);
  for (const f of TEMPLATE_BASE_FILES) {
    if (!fileSet.has(f)) files.push(f);
  }

  const BATCH = 20;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (relPath) => {
        // For package.json and template base files, prefer template copy
        const useTemplate = relPath === "package.json" || TEMPLATE_BASE_FILES.includes(relPath);
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
 * Compare project package.json with template package.json.
 * Returns a list of "pkg@version" strings for deps that are NOT in the template.
 * If node_modules is completely missing, returns null → full install needed.
 */
async function getMissingDeps(sandbox: Sandbox): Promise<string[] | null> {
  // If no node_modules at all, need full install
  const check = await sandbox.commands.run(
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
  try {
    const res = await fetch(previewUrl, { signal: AbortSignal.timeout(3000) });
    const text = await res.text().catch(() => "");
    return res.ok && !text.includes("Closed Port Error");
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startDevServer(
  projectId: string
): Promise<{ url: string; port: number }> {
  const projectDir = getSiteRoot(projectId);
  try {
    await fs.access(projectDir);
  } catch {
    // Directory missing — try restoring from Supabase Storage
    console.log(`[devServerManager] Project dir missing, attempting restore from storage: ${projectId}`);
    const restored = await restoreProjectFiles(projectId);
    if (restored.length === 0) {
      throw new Error(`Project directory not found: ${projectDir}`);
    }
    console.log(`[devServerManager] Restored ${restored.length} files from storage`);
  }

  // 1. Try reconnecting to existing sandbox
  const existingSandboxId = await getSandboxId(projectId);
  if (existingSandboxId) {
    try {
      const sandbox = await Sandbox.connect(existingSandboxId, e2bOpts());
      const alive = await sandbox.isRunning();
      if (alive) {
        const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
        if (await isServerUp(sandbox)) {
          await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
          return { url: previewUrl, port: SERVE_PORT };
        }
        // Sandbox alive but server not running — check if /out exists
        const hasOut = await sandbox.commands.run("test -d /home/user/app/out && echo YES || echo NO");
        if (hasOut.stdout.trim() === "YES") {
          await startServeAndWait(sandbox);
          await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
          return { url: previewUrl, port: SERVE_PORT };
        }
        // No /out — need full rebuild, kill and recreate
      }
    } catch { /* expired or unreachable */ }
    await clearSandboxId(projectId);
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

    // 5. Install deps — only missing ones if template has node_modules
    const missingDeps = await getMissingDeps(sandbox);
    if (missingDeps === null) {
      // No node_modules at all → full install
      console.log("[e2b] No node_modules found, running full npm install...");
      const installResult = await sandbox.commands.run(
        "cd /home/user/app && npm install --legacy-peer-deps 2>&1",
        { timeoutMs: 120_000 }
      );
      if (installResult.exitCode !== 0) {
        throw new Error(`npm install failed (exit ${installResult.exitCode}): ${installResult.stdout.slice(-500)}`);
      }
    } else if (missingDeps.length > 0) {
      // Only install the new packages
      console.log(`[e2b] Installing ${missingDeps.length} extra deps:`, missingDeps.join(", "));
      const installResult = await sandbox.commands.run(
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
    const buildResult = await sandbox.commands.run(
      "cd /home/user/app && npx next build 2>&1",
      { timeoutMs: 120_000 }
    );
    console.log("[e2b] next build exit code:", buildResult.exitCode);
    if (buildResult.exitCode !== 0) {
      throw new Error(`next build failed (exit ${buildResult.exitCode}): ${buildResult.stdout.slice(-500)}`);
    }

    // 7. Start static file server
    console.log("[e2b] Starting static server...");
    await startServeAndWait(sandbox);

    const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
    await saveSandboxId(projectId, sandbox.sandboxId);
    return { url: previewUrl, port: SERVE_PORT };
  } catch (err) {
    await sandbox.kill().catch(() => { });
    throw err;
  }
}

export async function stopDevServer(projectId: string): Promise<void> {
  const sandboxId = await getSandboxId(projectId);
  if (sandboxId) {
    try { await Sandbox.kill(sandboxId, e2bOpts()); } catch { /* already dead */ }
    await clearSandboxId(projectId);
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
 * Classify modification diffs to determine if a full rebuild is needed
 * or if a lightweight file-swap + browser refresh is sufficient.
 */
export type PreviewRefreshMode = "hot" | "rebuild";

export function classifyModificationScope(
  diffs: Array<{ file: string; patch: string; stats: { additions: number; deletions: number } }>
): PreviewRefreshMode {
  if (diffs.length === 0) return "hot";

  for (const diff of diffs) {
    const { file, patch } = diff;

    // New or deleted files always need rebuild
    if (diff.stats.additions > 0 && diff.stats.deletions === 0 && patch.includes("--- /dev/null")) {
      return "rebuild";
    }

    // Changes to config files need rebuild
    if (
      file === "next.config.ts" ||
      file === "tsconfig.json" ||
      file === "package.json" ||
      file === "postcss.config.mjs" ||
      file === "tailwind.config.ts"
    ) {
      return "rebuild";
    }

    // Changes to layout.tsx need rebuild (affects all pages)
    if (file === "app/layout.tsx") {
      return "rebuild";
    }

    // Analyze the patch content for structural vs cosmetic changes
    const patchLines = patch.split("\n");
    for (const line of patchLines) {
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      const content = line.slice(1).trim();
      if (!content) continue;

      // Import changes need rebuild
      if (content.startsWith("import ") || content.startsWith("export ")) {
        // Exception: re-exports of existing components are fine
        if (!content.includes("from ")) continue;
        return "rebuild";
      }

      // New component definitions need rebuild
      if (content.match(/^(export\s+)?(function|const|class)\s+\w+/)) {
        return "rebuild";
      }
    }
  }

  // If we got here, changes are likely cosmetic (text, className, CSS values)
  return "hot";
}

/**
 * Hot-refresh: upload changed files to sandbox and trigger browser reload.
 * No `next build` — just file swap + serve restart.
 * Only works for cosmetic changes (text, CSS, className).
 */
export async function hotRefreshDevServer(
  projectId: string,
  changedFiles: string[]
): Promise<{ url: string; port: number; mode: "hot" }> {
  const sandboxId = await getSandboxId(projectId);
  if (!sandboxId) {
    // No sandbox — fall back to full start
    const result = await startDevServer(projectId);
    return { ...result, mode: "hot" };
  }

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.connect(sandboxId, e2bOpts());
    if (!(await sandbox.isRunning())) throw new Error("not running");
  } catch {
    await clearSandboxId(projectId);
    const result = await startDevServer(projectId);
    return { ...result, mode: "hot" };
  }

  console.log(`[e2b hot] Uploading ${changedFiles.length} changed file(s) to sandbox ${sandboxId}`);

  // Upload only the changed files
  await uploadFilesToSandbox(sandbox, projectId, changedFiles);

  // For static export, we need to rebuild even for hot refresh
  // But we can skip dependency installation since no imports changed
  console.log("[e2b hot] Rebuilding static site (no dep install)...");

  // Kill existing serve and clean stale build cache
  await sandbox.commands.run("pkill -f 'serve out' || true");
  await sandbox.commands.run("cd /home/user/app && rm -rf .next out");

  // Rebuild
  const buildResult = await sandbox.commands.run(
    "cd /home/user/app && npx next build 2>&1",
    { timeoutMs: 120_000 }
  );

  if (buildResult.exitCode !== 0) {
    // Hot refresh failed — fall back to full rebuild
    console.warn("[e2b hot] Build failed, falling back to full rebuild");
    const result = await rebuildDevServer(projectId);
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
  projectId: string
): Promise<{ url: string; port: number }> {
  const sandboxId = await getSandboxId(projectId);

  let sandbox: Sandbox | null = null;

  if (sandboxId) {
    try {
      const candidate = await Sandbox.connect(sandboxId, e2bOpts());
      if (!(await candidate.isRunning())) throw new Error("not running");
      // Quick health check
      const healthCheck = await candidate.commands.run("echo OK", { timeoutMs: 5_000 });
      if (healthCheck.exitCode !== 0 || !healthCheck.stdout.includes("OK")) {
        throw new Error("sandbox unhealthy");
      }
      sandbox = candidate;
    } catch {
      await clearSandboxId(projectId);
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

    // 1. Kill existing serve process
    await sandbox.commands.run("pkill -f 'serve out' || true");

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
      const r = await sandbox.commands.run("cd /home/user/app && npm install --legacy-peer-deps 2>&1", { timeoutMs: 120_000 });
      if (r.exitCode !== 0) throw new Error(`npm install failed: ${r.stdout.slice(-300)}`);
    } else if (missingDeps.length > 0) {
      console.log(`[e2b rebuild] Installing ${missingDeps.length} extra deps`);
      const r = await sandbox.commands.run(`cd /home/user/app && npm install --legacy-peer-deps ${missingDeps.join(" ")} 2>&1`, { timeoutMs: 120_000 });
      if (r.exitCode !== 0) throw new Error(`npm install extras failed: ${r.stdout.slice(-300)}`);
    }

    // 6. Rebuild
    console.log("[e2b rebuild] Building...");
    const buildResult = await sandbox.commands.run("cd /home/user/app && npx next build 2>&1", { timeoutMs: 120_000 });
    if (buildResult.exitCode !== 0) {
      throw new Error(`next build failed (exit ${buildResult.exitCode}): ${buildResult.stdout.slice(-500)}`);
    }

    // 7. Restart serve
    console.log("[e2b rebuild] Restarting serve...");
    await startServeAndWait(sandbox);

    const previewUrl = `https://${sandbox.getHost(SERVE_PORT)}`;
    await saveSandboxId(projectId, sandbox.sandboxId);
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

export async function getDevServerStatus(
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const sandboxId = await getSandboxId(projectId);
  if (!sandboxId) return { status: "stopped" };
  try {
    const sandbox = await Sandbox.connect(sandboxId, e2bOpts());
    if (await sandbox.isRunning()) {
      const url = `https://${sandbox.getHost(SERVE_PORT)}`;
      return { status: "running", url };
    }
  } catch { /* unreachable */ }
  await clearSandboxId(projectId);
  return { status: "stopped" };
}
