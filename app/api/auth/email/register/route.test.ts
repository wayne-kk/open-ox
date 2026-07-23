import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signUp = vi.fn();

vi.mock("@/lib/auth/email-auth-rate-limit", () => ({
  checkEmailAuthRateLimit: () => ({ ok: true }),
}));

vi.mock("@/lib/auth/email-auth-server", () => ({
  createEmailAuthSupabaseClient: () => ({
    supabase: { auth: { signUp } },
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  }),
}));

vi.mock("@/lib/auth/post-login", () => ({
  finalizeAuthenticatedLogin: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/auth/email/register", () => {
  beforeEach(() => {
    signUp.mockReset();
  });

  it("reports an already registered email when Supabase returns an obfuscated user", async () => {
    signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: "obfuscated", identities: [] },
      },
      error: null,
    });

    const response = await POST(
      new NextRequest("https://open-ox.tech/api/auth/email/register", {
        method: "POST",
        body: JSON.stringify({
          email: "existing@example.com",
          password: "password123",
          confirmPassword: "password123",
          next: "/dashboard",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "emailAlreadyRegistered",
    });
  });

  it("requests confirmation for a newly created user with an email identity", async () => {
    signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: "new-user", identities: [{ identity_id: "email-identity" }] },
      },
      error: null,
    });

    const response = await POST(
      new NextRequest("https://open-ox.tech/api/auth/email/register", {
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          password: "password123",
          confirmPassword: "password123",
          next: "/dashboard",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      needsEmailConfirmation: true,
      email: "new@example.com",
    });
  });
});
