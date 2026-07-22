import { describe, expect, it, beforeEach } from "vitest";
import {
  checkEmailAuthRateLimit,
  clearEmailAuthRateLimitForTests,
} from "./email-auth-rate-limit";

describe("email auth rate limit", () => {
  beforeEach(() => clearEmailAuthRateLimitForTests());

  it("limits by action, ip, and email within a window", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });
    for (let i = 0; i < 3; i += 1) {
      expect(
        checkEmailAuthRateLimit({
          action: "password_reset",
          email: "anna@example.com",
          headers,
          nowMs: 1000,
        })
      ).toEqual({ ok: true });
    }
    expect(
      checkEmailAuthRateLimit({
        action: "password_reset",
        email: "anna@example.com",
        headers,
        nowMs: 1000,
      })
    ).toMatchObject({ ok: false, retryAfterSec: 600 });
  });

  it("resets after the window", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });
    for (let i = 0; i < 3; i += 1) {
      checkEmailAuthRateLimit({
        action: "resend_verification",
        email: "anna@example.com",
        headers,
        nowMs: 1000,
      });
    }
    expect(
      checkEmailAuthRateLimit({
        action: "resend_verification",
        email: "anna@example.com",
        headers,
        nowMs: 1000 + 10 * 60 * 1000,
      })
    ).toEqual({ ok: true });
  });
});
