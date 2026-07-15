import path from "path";
import { describe, expect, it } from "vitest";
import {
  nodeModulesSymlinkEscapesRoot,
  pnpmNextBuildArgv,
} from "./ensureProjectNodeModules";

describe("nodeModulesSymlinkEscapesRoot", () => {
  const projectDir = "/app/sites/proj-1";

  it("flags absolute targets outside the project", () => {
    expect(
      nodeModulesSymlinkEscapesRoot(projectDir, "/opt/ox-sites-template/node_modules")
    ).toBe(true);
  });

  it("flags relative targets that resolve outside the project", () => {
    expect(nodeModulesSymlinkEscapesRoot(projectDir, "../template/node_modules")).toBe(true);
  });

  it("allows targets inside the project", () => {
    expect(nodeModulesSymlinkEscapesRoot(projectDir, ".vendor/node_modules")).toBe(false);
    expect(
      nodeModulesSymlinkEscapesRoot(projectDir, path.join(projectDir, "vendor", "node_modules"))
    ).toBe(false);
  });
});

describe("pnpmNextBuildArgv", () => {
  it("uses Turbopack by default", () => {
    expect(pnpmNextBuildArgv(false)).toEqual(["exec", "next", "build"]);
  });

  it("adds --webpack when preferWebpackBuild", () => {
    expect(pnpmNextBuildArgv(true)).toEqual(["exec", "next", "build", "--webpack"]);
  });
});
