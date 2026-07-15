/**
 * PM2 process file for production (web + generation worker).
 *
 *   cd /sharedata/wayne/open-ox && pm2 startOrReload ecosystem.config.cjs --update-env
 *
 * Env is loaded from `.env.production` at reload time (see scripts/deploy-on-server.sh).
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(ROOT, ".env.production"));

const sharedEnv = {
  ...fileEnv,
  NODE_ENV: "production",
  // Persist Playwright browsers across deploys (installed once by server-setup).
  PLAYWRIGHT_BROWSERS_PATH:
    fileEnv.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(ROOT, ".playwright", "browsers"),
};

module.exports = {
  apps: [
    {
      name: "open-ox",
      cwd: ROOT,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1536M",
      kill_timeout: 10_000,
      listen_timeout: 15_000,
      env: {
        ...sharedEnv,
        PORT: sharedEnv.PORT || "3000",
        HOSTNAME: sharedEnv.HOSTNAME || "0.0.0.0",
      },
    },
    {
      name: "open-ox-generation-worker",
      cwd: ROOT,
      script: "scripts/generation-worker.ts",
      interpreter: "node_modules/tsx/dist/cli.mjs",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "2048M",
      kill_timeout: 30_000,
      env: {
        ...sharedEnv,
        OPEN_OX_WORKER_ID: sharedEnv.OPEN_OX_WORKER_ID || "pm2-worker-1",
      },
    },
  ],
};
