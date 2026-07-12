#!/usr/bin/env npx tsx
/**
 * Validate Core environment variables.
 * Loads `.env.local` then `.env` (without overriding existing process.env).
 * Usage: pnpm check:env
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCoreEnvHelp, reportCoreEnv } from "../lib/env";

function loadEnvFile(fileName: string): void {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const report = reportCoreEnv();
if (!report.ok) {
  console.error(formatCoreEnvHelp(report));
  process.exit(1);
}

console.log("Core environment variables are set.");
