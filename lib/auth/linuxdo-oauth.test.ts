import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLinuxDoAuthorizeUrl,
  exchangeLinuxDoCode,
  linuxdoDerivedPassword,
  linuxdoSyntheticEmail,
  resolveLinuxDoAvatarUrl,
  timingSafeEqualString,
} from "./linuxdo-oauth";

describe("linuxdo-oauth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds authorize URL with state and user scope", () => {
    const url = buildLinuxDoAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://app.example/api/auth/linuxdo/callback",
      state: "abc123",
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(
      "https://connect.linux.do/oauth2/authorize",
    );
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "https://app.example/api/auth/linuxdo/callback",
    );
    expect(u.searchParams.get("state")).toBe("abc123");
    expect(u.searchParams.get("scope")).toBe("user");
  });

  it("derives stable synthetic email and password per id", () => {
    vi.stubEnv("LINUXDO_OAUTH_HMAC_SECRET", "test-hmac-secret-32chars!!");
    const emailA = linuxdoSyntheticEmail("42");
    const emailB = linuxdoSyntheticEmail("42");
    const emailC = linuxdoSyntheticEmail("43");
    expect(emailA).toBe(emailB);
    expect(emailA).not.toBe(emailC);
    expect(emailA.endsWith("@linuxdo.open-ox.local")).toBe(true);

    const pwA = linuxdoDerivedPassword("42");
    const pwB = linuxdoDerivedPassword("42");
    expect(pwA).toBe(pwB);
    expect(pwA.length).toBeGreaterThan(16);
  });

  it("resolves avatar_template to absolute URL", () => {
    expect(
      resolveLinuxDoAvatarUrl("/user_avatar/linux.do/alice/{size}/1_2.png"),
    ).toBe("https://linux.do/user_avatar/linux.do/alice/120/1_2.png");
    expect(resolveLinuxDoAvatarUrl("https://cdn.example/{size}.png", 48)).toBe(
      "https://cdn.example/48.png",
    );
    expect(resolveLinuxDoAvatarUrl(undefined)).toBeUndefined();
  });

  it("compares state strings in constant time", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "ab")).toBe(false);
  });

  it("reports a safe token transport error code", async () => {
    const cause = Object.assign(new Error("private network detail"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed", { cause }),
    );

    await expect(
      exchangeLinuxDoCode({
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "authorization-code",
        redirectUri: "https://app.example/api/auth/linuxdo/callback",
      }),
    ).rejects.toThrow("Linux.do token network error: UND_ERR_CONNECT_TIMEOUT");
  });
});
