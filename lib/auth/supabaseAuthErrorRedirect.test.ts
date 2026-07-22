import { describe, expect, it } from "vitest";
import {
  supabaseAuthCodeRedirectSearch,
  supabaseAuthErrorRedirectSearch,
} from "./supabaseAuthErrorRedirect";

describe("supabaseAuthErrorRedirectSearch", () => {
  it("maps expired OTP links to auth page params", () => {
    const params = new URLSearchParams({
      error: "access_denied",
      error_code: "otp_expired",
      error_description: "Email link is invalid or has expired",
    });

    expect(supabaseAuthErrorRedirectSearch(params)).toBe(
      "?error=otp_expired&msg=Email+link+is+invalid+or+has+expired"
    );
  });

  it("ignores ordinary root requests", () => {
    expect(supabaseAuthErrorRedirectSearch(new URLSearchParams("utm_source=x"))).toBeNull();
  });
});

describe("supabaseAuthCodeRedirectSearch", () => {
  it("preserves root-level auth codes for the callback route", () => {
    expect(
      supabaseAuthCodeRedirectSearch(
        new URLSearchParams({
          code: "66e844ea-a30c-4bbd-8052-1bdde29587ed",
          redirect: "/dashboard",
        })
      )
    ).toBe("?code=66e844ea-a30c-4bbd-8052-1bdde29587ed&next=%2Fdashboard");
  });

  it("ignores ordinary root requests", () => {
    expect(supabaseAuthCodeRedirectSearch(new URLSearchParams("utm_source=x"))).toBeNull();
  });
});
