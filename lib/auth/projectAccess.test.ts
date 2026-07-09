import { describe, expect, it } from "vitest";
import {
  canAccessStaticPreview,
  isProjectOwner,
} from "@/lib/auth/projectAccess";

describe("isProjectOwner", () => {
  it("requires matching ownerUserId", () => {
    expect(isProjectOwner({ ownerUserId: "u1" }, "u1")).toBe(true);
    expect(isProjectOwner({ ownerUserId: "u1" }, "u2")).toBe(false);
    expect(isProjectOwner({}, "u1")).toBe(false);
  });
});

describe("canAccessStaticPreview", () => {
  const owned = { ownerUserId: "owner-1" };

  it("allows owner and admin", () => {
    expect(canAccessStaticPreview(owned, { userId: "owner-1" })).toBe(true);
    expect(canAccessStaticPreview(owned, { userId: "other", isAdmin: true })).toBe(true);
  });

  it("denies anonymous and other users when not published", () => {
    expect(canAccessStaticPreview(owned, { userId: null })).toBe(false);
    expect(canAccessStaticPreview(owned, { userId: "other" })).toBe(false);
  });

  it("allows non-owners when publishPreview is on (slice 02 seam)", () => {
    expect(
      canAccessStaticPreview(
        { ...owned, publishPreview: true },
        { userId: null }
      )
    ).toBe(true);
    expect(
      canAccessStaticPreview(
        { ...owned, publishPreview: true },
        { userId: "other" }
      )
    ).toBe(true);
  });
});
