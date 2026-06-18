import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getInternalEmailDomains,
  isInternalEmail,
  isInternalUser,
  filterExternalUsers,
} from "@/lib/admin/analytics/internalAccounts";

describe("internalAccounts", () => {
  const original = process.env.ANALYTICS_INTERNAL_EMAIL_DOMAINS;

  beforeEach(() => {
    process.env.ANALYTICS_INTERNAL_EMAIL_DOMAINS = "open-ox.com, example.org";
  });

  afterEach(() => {
    process.env.ANALYTICS_INTERNAL_EMAIL_DOMAINS = original;
  });

  it("parses internal email domains", () => {
    expect(getInternalEmailDomains()).toEqual(["open-ox.com", "example.org"]);
  });

  it("detects internal emails by domain", () => {
    expect(isInternalEmail("dev@open-ox.com")).toBe(true);
    expect(isInternalEmail("user@gmail.com")).toBe(false);
  });

  it("treats admins and manual ids as internal", () => {
    expect(
      isInternalUser({
        userId: "u1",
        email: "user@gmail.com",
        adminUserIds: new Set(["u1"]),
        manualInternalIds: new Set(),
      })
    ).toBe(true);
    expect(
      filterExternalUsers(
        [
          { id: "u1", email: "a@open-ox.com" },
          { id: "u2", email: "b@gmail.com" },
        ],
        { adminUserIds: new Set(), manualInternalIds: new Set() }
      ).map((user) => user.id)
    ).toEqual(["u2"]);
  });
});
