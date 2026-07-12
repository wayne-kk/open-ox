import { describe, expect, it } from "vitest";
import {
  openOxVercelReconnectHref,
  vercelIntegrationPermissionsDocsUrl,
  vercelIntegrationsDashboardUrl,
  vercelProjectDashboardUrl,
  vercelTeamIntegrationsUrl,
} from "./dashboardUrl";

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

describe("vercel integrations help URLs", () => {
  it("returns account integrations dashboard", () => {
    expect(vercelIntegrationsDashboardUrl()).toBe("https://vercel.com/dashboard/integrations");
  });

  it("returns team integrations when slug present", () => {
    expect(vercelTeamIntegrationsUrl("acme")).toBe("https://vercel.com/acme/~/integrations");
    expect(vercelTeamIntegrationsUrl(null)).toBeNull();
    expect(vercelTeamIntegrationsUrl("  ")).toBeNull();
  });

  it("returns permissions docs and reconnect path", () => {
    expect(vercelIntegrationPermissionsDocsUrl()).toContain("manage-integrations-reference");
    expect(openOxVercelReconnectHref()).toBe(
      "/api/integrations/vercel/start?next=/settings/integrations"
    );
  });
});
