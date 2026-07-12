import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertCoreEnv,
  envCapabilities,
  envFlagDisabled,
  envFlagEnabled,
  envString,
  formatCoreEnvHelp,
  getSiteUrl,
  isArkImageConfigured,
  isCreditsEnabled,
  isE2bConfigured,
  isFeishuOAuthConfigured,
  isGoogleOAuthConfigured,
  isLangfuseConfigured,
  isStripeBillingConfigured,
  isVercelDeployConfigured,
  reportCoreEnv,
} from "./env";

describe("envString / flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trims and treats blank as missing", () => {
    vi.stubEnv("FOO", "  bar  ");
    expect(envString("FOO")).toBe("bar");
    vi.stubEnv("FOO", "   ");
    expect(envString("FOO")).toBeUndefined();
  });

  it("parses enabled / disabled flags", () => {
    vi.stubEnv("A", "TRUE");
    expect(envFlagEnabled("A")).toBe(true);
    vi.stubEnv("B", "no");
    expect(envFlagDisabled("B")).toBe(true);
  });
});

describe("reportCoreEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists missing Core keys", () => {
    const report = reportCoreEnv({});
    expect(report.ok).toBe(false);
    expect(report.missing).toContain("OPENAI_API_KEY");
    expect(report.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("accepts NEXT_PUBLIC_APP_URL as site URL fallback", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "pk",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      SUPABASE_SERVICE_ROLE_KEY: "srk",
      OPENAI_API_KEY: "sk",
    };
    expect(reportCoreEnv(env).ok).toBe(true);
    expect(getSiteUrl(env)).toBe("http://localhost:3000");
  });

  it("assertCoreEnv throws a helpful message", () => {
    expect(() => assertCoreEnv({})).toThrow(/Missing Core/);
    expect(formatCoreEnvHelp(reportCoreEnv({}))).toContain(".env.example");
  });
});

describe("capability gates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gates Feishu on id, secret, hmac, service role", () => {
    expect(isFeishuOAuthConfigured({})).toBe(false);
    vi.stubEnv("FEISHU_APP_ID", "id");
    vi.stubEnv("FEISHU_APP_SECRET", "secret");
    vi.stubEnv("FEISHU_OAUTH_HMAC_SECRET", "hmac");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
    expect(isFeishuOAuthConfigured()).toBe(true);
  });

  it("gates Google on Supabase public env unless disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "pk");
    expect(isGoogleOAuthConfigured()).toBe(true);
    vi.stubEnv("GOOGLE_LOGIN_ENABLED", "false");
    expect(isGoogleOAuthConfigured()).toBe(false);
  });

  it("gates Vercel, Stripe, Credits, Langfuse, ARK, E2B", () => {
    expect(isVercelDeployConfigured({})).toBe(false);
    expect(isStripeBillingConfigured({})).toBe(false);
    expect(isCreditsEnabled({})).toBe(false);
    expect(isLangfuseConfigured({})).toBe(false);
    expect(isArkImageConfigured({})).toBe(false);
    expect(isE2bConfigured({})).toBe(false);

    vi.stubEnv("VERCEL_CLIENT_ID", "id");
    vi.stubEnv("VERCEL_CLIENT_SECRET", "secret");
    vi.stubEnv("VERCEL_TOKEN_ENCRYPTION_KEY", "enc-key-16chars!");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
    expect(isVercelDeployConfigured()).toBe(true);

    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    expect(isStripeBillingConfigured()).toBe(true);

    vi.stubEnv("CREDITS_ENABLED", "1");
    expect(isCreditsEnabled()).toBe(true);

    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk");
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk");
    expect(isLangfuseConfigured()).toBe(true);

    vi.stubEnv("ARK_API_KEY", "ark");
    expect(isArkImageConfigured()).toBe(true);

    vi.stubEnv("E2B_API_KEY", "e2b");
    expect(isE2bConfigured()).toBe(true);

    const caps = envCapabilities();
    expect(caps.vercelDeploy).toBe(true);
    expect(caps.stripeBilling).toBe(true);
    expect(caps.credits).toBe(true);
    expect(caps.langfuse).toBe(true);
    expect(caps.arkImage).toBe(true);
    expect(caps.e2b).toBe(true);
  });
});
