import { describe, expect, it } from "vitest";
import { supabaseAuthErrorRedirectSearch } from "./supabaseAuthErrorRedirect";

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
