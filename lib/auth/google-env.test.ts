import { afterEach, describe, expect, it } from "vitest";
import { isGoogleOAuthConfigured } from "./google-env";

const ENV_KEYS = [
  "GOOGLE_LOGIN_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
] as const;

describe("isGoogleOAuthConfigured", () => {
  const snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns true when Supabase public env is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "pk_test";
    delete process.env.GOOGLE_LOGIN_ENABLED;
    expect(isGoogleOAuthConfigured()).toBe(true);
  });

  it("returns false when explicitly disabled", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "pk_test";
    process.env.GOOGLE_LOGIN_ENABLED = "false";
    expect(isGoogleOAuthConfigured()).toBe(false);
  });

  it("returns false when Supabase env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    expect(isGoogleOAuthConfigured()).toBe(false);
  });
});
