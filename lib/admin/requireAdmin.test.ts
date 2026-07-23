import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, isAdminUser } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/auth/roles", () => ({ isAdminUser }));

import { requireAdmin } from "./requireAdmin";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when the session lookup exhausts network retries", async () => {
    getSessionUser.mockRejectedValue(new TypeError("fetch failed"));

    const result = await requireAdmin();

    expect("error" in result && result.error.status).toBe(503);
  });

  it("returns 503 when the role lookup fails", async () => {
    getSessionUser.mockResolvedValue({
      user: { id: "admin-user" },
      supabase: {},
    });
    isAdminUser.mockRejectedValue(new TypeError("fetch failed"));

    const result = await requireAdmin();

    expect(isAdminUser).toHaveBeenCalledWith(expect.objectContaining({ throwOnError: true }));
    expect("error" in result && result.error.status).toBe(503);
  });
});
