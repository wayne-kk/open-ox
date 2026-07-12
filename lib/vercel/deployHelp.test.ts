import { describe, expect, it } from "vitest";
import { classifyDeployHelp, deployHelpLinks } from "./deployHelp";
import { VERCEL_CREATE_PROJECT_PERMISSION_HINT } from "./createProjectPermission";

describe("classifyDeployHelp", () => {
  it("detects create-permission 403", () => {
    expect(
      classifyDeployHelp("Vercel API 403: You don't have permission to create the project.")
    ).toBe("create_permission");
    expect(classifyDeployHelp(VERCEL_CREATE_PROJECT_PERMISSION_HINT)).toBe("create_permission");
  });

  it("detects not connected", () => {
    expect(classifyDeployHelp("Vercel not connected")).toBe("not_connected");
    expect(classifyDeployHelp("未连接 Vercel")).toBe("not_connected");
  });

  it("falls back to generic", () => {
    expect(classifyDeployHelp("build failed: OOM")).toBe("generic");
    expect(classifyDeployHelp(null)).toBe("generic");
  });
});

describe("deployHelpLinks", () => {
  it("for create permission includes integrations, docs, reconnect", () => {
    const links = deployHelpLinks({
      error: "Vercel API 403: You don't have permission to create the project.",
      teamSlug: "acme",
    });
    expect(links.map((l) => l.id)).toEqual([
      "integrations",
      "team_integrations",
      "docs",
      "reconnect",
    ]);
    expect(links.find((l) => l.id === "team_integrations")?.href).toBe(
      "https://vercel.com/acme/~/integrations"
    );
  });

  it("for not_connected only reconnects on a row", () => {
    expect(deployHelpLinks({ error: "Vercel not connected" }).map((l) => l.id)).toEqual([
      "reconnect",
    ]);
  });

  it("panel always includes the full troubleshooting set", () => {
    const links = deployHelpLinks({ panel: true, teamSlug: null });
    expect(links.map((l) => l.id)).toEqual(["integrations", "docs", "reconnect"]);
  });
});
