import { describe, expect, it } from "vitest";
import {
  EMAIL_PASSWORD_MIN_LENGTH,
  isValidEmail,
  normalizeEmail,
  normalizeSupabaseAuthError,
  validateEmailAndPassword,
} from "./email-auth";

describe("email auth helpers", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail(" Anna@Example.COM ")).toBe("anna@example.com");
    expect(isValidEmail("anna@example.com")).toBe(true);
    expect(isValidEmail("anna@example")).toBe(false);
  });

  it("validates password length and confirmation", () => {
    expect(
      validateEmailAndPassword({
        email: "anna@example.com",
        password: "short",
        confirmPassword: "short",
      })
    ).toMatchObject({ ok: false, code: "passwordShort" });

    expect(
      validateEmailAndPassword({
        email: "anna@example.com",
        password: "long-enough",
        confirmPassword: "different",
      })
    ).toMatchObject({ ok: false, code: "passwordMismatch" });

    expect(
      validateEmailAndPassword({
        email: "anna@example.com",
        password: "x".repeat(EMAIL_PASSWORD_MIN_LENGTH),
        confirmPassword: "x".repeat(EMAIL_PASSWORD_MIN_LENGTH),
      })
    ).toBeNull();
  });

  it("maps Supabase auth errors into product codes", () => {
    expect(normalizeSupabaseAuthError({ message: "User already registered" })).toMatchObject({
      ok: false,
      code: "emailAlreadyRegistered",
    });
    expect(normalizeSupabaseAuthError({ message: "Invalid login credentials" })).toMatchObject({
      ok: false,
      code: "invalidCredentials",
    });
    expect(normalizeSupabaseAuthError({ message: "Email not confirmed" })).toMatchObject({
      ok: false,
      code: "emailNotConfirmed",
    });
    expect(normalizeSupabaseAuthError({ status: 429, message: "Too many requests" })).toMatchObject({
      ok: false,
      code: "rateLimited",
    });
  });
});
