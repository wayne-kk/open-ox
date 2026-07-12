import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";
import { isVercelDeployConfigured } from "./env";
import { vercelProjectNameForOpenOx } from "./oauth";

describe("vercel crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips secrets", () => {
    vi.stubEnv("VERCEL_TOKEN_ENCRYPTION_KEY", "test-key-at-least-16-chars");
    const enc = encryptSecret("vercel-access-token-xyz");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe("vercel-access-token-xyz");
  });
});

describe("isVercelDeployConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires client id, secret, encryption key, and service role", () => {
    vi.stubEnv("VERCEL_CLIENT_ID", "id");
    vi.stubEnv("VERCEL_CLIENT_SECRET", "secret");
    vi.stubEnv("VERCEL_TOKEN_ENCRYPTION_KEY", "enc-key-16chars!");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
    expect(isVercelDeployConfigured()).toBe(true);
  });

  it("is false when encryption key missing", () => {
    vi.stubEnv("VERCEL_CLIENT_ID", "id");
    vi.stubEnv("VERCEL_CLIENT_SECRET", "secret");
    vi.stubEnv("VERCEL_TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
    expect(isVercelDeployConfigured()).toBe(false);
  });
});

describe("vercelProjectNameForOpenOx", () => {
  it("produces a stable hyphenated name with project id suffix", () => {
    const a = vercelProjectNameForOpenOx("proj_abc", "My Cool Site!");
    const b = vercelProjectNameForOpenOx("proj_abc", "My Cool Site!");
    expect(a).toBe(b);
    expect(a).toMatch(/^my-cool-site-[a-f0-9]{8}$/);
  });
});
