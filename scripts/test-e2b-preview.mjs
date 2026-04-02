#!/usr/bin/env node
/**
 * E2B Preview End-to-End Diagnostic Script
 * Tests each step of the sandbox preview flow independently.
 */
import { Sandbox } from "e2b";
import fs from "fs/promises";
import path from "path";

const API_KEY = process.env.E2B_API_KEY;
const TEMPLATE = "9zcpgdq2dtw5o3stjbrp";

if (!API_KEY) {
  console.error("❌ E2B_API_KEY not set");
  process.exit(1);
}

const opts = { apiKey: API_KEY };

async function step(name, fn) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ ${name}`);
  console.log("=".repeat(60));
  try {
    const result = await fn();
    console.log(`✅ ${name} — OK`);
    return result;
  } catch (err) {
    console.error(`❌ ${name} — FAILED:`, err.message || err);
    throw err;
  }
}

async function main() {
  let sandbox;

  try {
    // Step 1: Create sandbox
    sandbox = await step("Create sandbox from template", async () => {
      const sb = await Sandbox.create(TEMPLATE, {
        timeoutMs: 5 * 60 * 1000,
        ...opts,
      });
      console.log("  sandboxId:", sb.sandboxId);
      return sb;
    });

    // Step 2: Check what's pre-installed
    await step("Check sandbox environment", async () => {
      const nodeV = await sandbox.commands.run("node --version");
      console.log("  Node:", nodeV.stdout.trim());
      const npmV = await sandbox.commands.run("npm --version");
      console.log("  npm:", npmV.stdout.trim());
      const hasServe = await sandbox.commands.run("which serve || echo NOT_FOUND");
      console.log("  serve:", hasServe.stdout.trim());
      const hasNpx = await sandbox.commands.run("which npx || echo NOT_FOUND");
      console.log("  npx:", hasNpx.stdout.trim());
      const diskSpace = await sandbox.commands.run("df -h /home/user");
      console.log("  disk:\n", diskSpace.stdout);
      const memInfo = await sandbox.commands.run("free -m 2>/dev/null || echo 'free not available'");
      console.log("  memory:\n", memInfo.stdout);
    });

    // Step 3: Check if node_modules exist from template
    await step("Check pre-installed node_modules", async () => {
      const check = await sandbox.commands.run("ls -la /home/user/app/node_modules 2>&1 || echo MISSING");
      console.log("  ", check.stdout.trim().slice(0, 300));
    });

    // Step 4: Upload a minimal Next.js project
    await step("Upload minimal test project", async () => {
      // Create minimal next.config.ts
      await sandbox.files.write("/home/user/app/next.config.ts", `
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};
export default nextConfig;
`);

      // Create package.json (use template's)
      const templatePkg = await fs.readFile("sites/template/package.json", "utf-8");
      await sandbox.files.write("/home/user/app/package.json", templatePkg);

      // Create tsconfig.json
      const tsconfig = await fs.readFile("sites/template/tsconfig.json", "utf-8").catch(() => null);
      if (tsconfig) {
        await sandbox.files.write("/home/user/app/tsconfig.json", tsconfig);
      }

      // Create postcss.config
      const postcss = await fs.readFile("sites/template/postcss.config.mjs", "utf-8").catch(() => null);
      if (postcss) {
        await sandbox.files.write("/home/user/app/postcss.config.mjs", postcss);
      }

      // Create minimal app/layout.tsx
      await sandbox.files.makeDir("/home/user/app/app");
      await sandbox.files.write("/home/user/app/app/layout.tsx", `
export const metadata = { title: "Test" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`);

      // Create minimal app/page.tsx
      await sandbox.files.write("/home/user/app/app/page.tsx", `
export default function Home() {
  return <div><h1>Hello from E2B sandbox</h1></div>;
}
`);

      // Verify files
      const ls = await sandbox.commands.run("find /home/user/app -type f | head -30");
      console.log("  Files uploaded:\n", ls.stdout);
    });

    // Step 5: npm install
    await step("npm install", async () => {
      const check = await sandbox.commands.run("test -d /home/user/app/node_modules && echo EXISTS || echo MISSING");
      if (check.stdout.trim() === "EXISTS") {
        console.log("  node_modules already exists, skipping install");
        return;
      }
      console.log("  Installing... (this may take a while)");
      const result = await sandbox.commands.run(
        "cd /home/user/app && npm install --legacy-peer-deps 2>&1",
        { timeoutMs: 180_000 }
      );
      console.log("  exit code:", result.exitCode);
      if (result.exitCode !== 0) {
        console.log("  LAST 500 chars:", result.stdout.slice(-500));
        throw new Error(`npm install failed with exit code ${result.exitCode}`);
      }
      console.log("  ✓ npm install succeeded");
    });

    // Step 6: next build
    await step("next build (static export)", async () => {
      console.log("  Building... (this may take a while)");
      const result = await sandbox.commands.run(
        "cd /home/user/app && npx next build 2>&1",
        { timeoutMs: 180_000 }
      );
      console.log("  exit code:", result.exitCode);
      console.log("  LAST 800 chars of output:\n", result.stdout.slice(-800));
      if (result.exitCode !== 0) {
        throw new Error(`next build failed with exit code ${result.exitCode}`);
      }
      // Check /out directory
      const outCheck = await sandbox.commands.run("ls -la /home/user/app/out/ 2>&1");
      console.log("  /out contents:\n", outCheck.stdout);
    });

    // Step 7: Start serve
    await step("Start static server (npx serve)", async () => {
      // Start serve in background
      const servePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("serve did not start in 30s")), 30_000);
        sandbox.commands.run(
          "cd /home/user/app && npx serve out -l 3000 --no-clipboard",
          {
            background: true,
            onStdout: (data) => {
              console.log("  [serve stdout]", data.trim());
              if (data.includes("Accepting connections") || data.includes("Listening on")) {
                clearTimeout(timer);
                resolve();
              }
            },
            onStderr: (data) => {
              console.log("  [serve stderr]", data.trim());
            },
          }
        ).catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      await servePromise;
    });

    // Step 8: Verify URL
    await step("Verify preview URL", async () => {
      const host = sandbox.getHost(3000);
      const url = `https://${host}`;
      console.log("  Preview URL:", url);

      // Wait a moment for serve to be fully ready
      await new Promise(r => setTimeout(r, 2000));

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      console.log("  HTTP status:", res.status);
      const body = await res.text();
      console.log("  Body length:", body.length);
      console.log("  Contains 'Hello':", body.includes("Hello"));
      if (body.includes("Closed Port Error")) {
        throw new Error("Port still closed — serve not reachable");
      }
      console.log("  🎉 Preview is live!");
    });

  } catch (err) {
    console.error("\n💀 Test failed:", err.message);
  } finally {
    if (sandbox) {
      console.log("\n🧹 Cleaning up — killing sandbox", sandbox.sandboxId);
      await Sandbox.kill(sandbox.sandboxId, opts).catch(() => {});
    }
  }
}

main();
