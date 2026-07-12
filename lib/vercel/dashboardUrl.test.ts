import { describe, expect, it } from "vitest";
import { vercelProjectDashboardUrl } from "./dashboardUrl";

describe("vercelProjectDashboardUrl", () => {
  it("prefers team slug + project name", () => {
    expect(
      vercelProjectDashboardUrl({
        vercelProjectName: "ox-demo",
        teamSlug: "acme",
        teamName: "Acme Inc",
      })
    ).toBe("https://vercel.com/acme/ox-demo");
  });

  it("falls back to dashboard when name missing", () => {
    expect(
      vercelProjectDashboardUrl({
        vercelProjectName: null,
        teamSlug: "acme",
      })
    ).toBe("https://vercel.com/dashboard");
  });
});
