/**
 * Typed env accessors + capability gates.
 *
 * Core vars are required for a meaningful local/prod run.
 * Everything else is optional and gated via isXxxConfigured().
 *
 * Do not throw at import time — Next builds and unit tests may lack secrets.
 * Use `reportCoreEnv` / `assertCoreEnv` (or `pnpm check:env`) when you need a hard gate.
 */

export const CORE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
] as const;

export type CoreEnvKey = (typeof CORE_ENV_KEYS)[number];

export type CoreEnvReport = {
  ok: boolean;
  missing: CoreEnvKey[];
};

type EnvSource = Record<string, string | undefined>;

function source(env?: EnvSource): EnvSource {
  return env ?? (process.env as EnvSource);
}

/** Trimmed string, or undefined when missing/blank. */
export function envString(name: string, env?: EnvSource): string | undefined {
  const v = source(env)[name]?.trim();
  return v ? v : undefined;
}

/** True for 1 / true / yes (case-insensitive). */
export function envFlagEnabled(name: string, env?: EnvSource): boolean {
  const v = envString(name, env)?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** True when explicitly set to false / 0 / no. */
export function envFlagDisabled(name: string, env?: EnvSource): boolean {
  const v = envString(name, env)?.toLowerCase();
  return v === "false" || v === "0" || v === "no";
}

/**
 * Public site origin. Prefers NEXT_PUBLIC_SITE_URL, falls back to NEXT_PUBLIC_APP_URL.
 * Trailing slash stripped.
 */
export function getSiteUrl(env?: EnvSource): string | undefined {
  const raw =
    envString("NEXT_PUBLIC_SITE_URL", env) || envString("NEXT_PUBLIC_APP_URL", env);
  return raw?.replace(/\/$/, "");
}

function corePresent(key: CoreEnvKey, env?: EnvSource): boolean {
  if (key === "NEXT_PUBLIC_SITE_URL") return Boolean(getSiteUrl(env));
  return Boolean(envString(key, env));
}

/** Which Core keys are missing (SITE_URL satisfied by APP_URL fallback). */
export function reportCoreEnv(env?: EnvSource): CoreEnvReport {
  const missing = CORE_ENV_KEYS.filter((key) => !corePresent(key, env));
  return { ok: missing.length === 0, missing };
}

export function formatCoreEnvHelp(report: CoreEnvReport): string {
  if (report.ok) return "Core environment variables are set.";
  const lines = [
    "Missing Core environment variables:",
    ...report.missing.map((k) => `  - ${k}`),
    "",
    "Copy .env.example → .env.local and fill the Core section.",
    "Run: pnpm check:env",
  ];
  return lines.join("\n");
}

/** Throws with a contributor-friendly message when Core env is incomplete. */
export function assertCoreEnv(env?: EnvSource): void {
  const report = reportCoreEnv(env);
  if (!report.ok) {
    throw new Error(formatCoreEnvHelp(report));
  }
}

// --- Capability gates (optional features) ---

export function isFeishuOAuthConfigured(env?: EnvSource): boolean {
  return Boolean(
    envString("FEISHU_APP_ID", env) &&
      envString("FEISHU_APP_SECRET", env) &&
      envString("FEISHU_OAUTH_HMAC_SECRET", env) &&
      envString("SUPABASE_SERVICE_ROLE_KEY", env)
  );
}

export function isLinuxDoOAuthConfigured(env?: EnvSource): boolean {
  return Boolean(
    envString("LINUXDO_CLIENT_ID", env) &&
      envString("LINUXDO_CLIENT_SECRET", env) &&
      envString("LINUXDO_OAUTH_HMAC_SECRET", env) &&
      envString("SUPABASE_SERVICE_ROLE_KEY", env)
  );
}

export function isGoogleOAuthConfigured(env?: EnvSource): boolean {
  if (envFlagDisabled("GOOGLE_LOGIN_ENABLED", env)) return false;
  return Boolean(
    envString("NEXT_PUBLIC_SUPABASE_URL", env) &&
      envString("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", env)
  );
}

export function isVercelDeployConfigured(env?: EnvSource): boolean {
  return Boolean(
    envString("VERCEL_CLIENT_ID", env) &&
      envString("VERCEL_CLIENT_SECRET", env) &&
      envString("VERCEL_TOKEN_ENCRYPTION_KEY", env) &&
      envString("SUPABASE_SERVICE_ROLE_KEY", env)
  );
}

export function isStripeBillingConfigured(env?: EnvSource): boolean {
  return Boolean(envString("STRIPE_SECRET_KEY", env));
}

export function isCreditsEnabled(env?: EnvSource): boolean {
  return envFlagEnabled("CREDITS_ENABLED", env);
}

export function isLangfuseConfigured(env?: EnvSource): boolean {
  return Boolean(envString("LANGFUSE_SECRET_KEY", env) && envString("LANGFUSE_PUBLIC_KEY", env));
}

export function isArkImageConfigured(env?: EnvSource): boolean {
  return Boolean(envString("ARK_API_KEY", env));
}

export function isE2bConfigured(env?: EnvSource): boolean {
  return Boolean(envString("E2B_API_KEY", env));
}

/** Snapshot of optional capability flags (for status / docs). */
export function envCapabilities(env?: EnvSource) {
  return {
    feishuLogin: isFeishuOAuthConfigured(env),
    linuxdoLogin: isLinuxDoOAuthConfigured(env),
    googleLogin: isGoogleOAuthConfigured(env),
    vercelDeploy: isVercelDeployConfigured(env),
    stripeBilling: isStripeBillingConfigured(env),
    credits: isCreditsEnabled(env),
    langfuse: isLangfuseConfigured(env),
    arkImage: isArkImageConfigured(env),
    e2b: isE2bConfigured(env),
  };
}
