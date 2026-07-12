import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/hasSupabaseAuthCookie";

describe("hasSupabaseAuthCookie", () => {
  it("returns false when no auth cookies", () => {
    expect(hasSupabaseAuthCookie([{ name: "locale" }, { name: "theme" }])).toBe(
      false
    );
  });

  it("detects sb auth token cookies", () => {
    expect(
      hasSupabaseAuthCookie([{ name: "sb-xxxx-auth-token" }])
    ).toBe(true);
    expect(
      hasSupabaseAuthCookie([{ name: "sb-xxxx-auth-token.0" }])
    ).toBe(true);
  });

  it("accepts cookie store iterable", () => {
    const request = {
      cookies: {
        getAll: () => [{ name: "sb-proj-auth-token" }],
      },
    } as unknown as NextRequest;
    expect(hasSupabaseAuthCookie(request.cookies.getAll())).toBe(true);
  });
});
