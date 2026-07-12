import { describe, expect, it } from "vitest";
import {
  LfSpanGen,
  LfSpanIntent,
  LfSpanModify,
  LfTrace,
  lfSpanGenInstallDeps,
  lfSpanGenPage,
} from "./langfuseTraceCatalog";

describe("langfuseTraceCatalog", () => {
  it("uses ox.trace prefix for root traces", () => {
    expect(LfTrace.projectBuild.startsWith("ox.trace.")).toBe(true);
    expect(LfTrace.projectBuild).toBe("ox.trace.project_build");
    expect(LfTrace.generateProject.startsWith("ox.trace.")).toBe(true);
    expect(LfTrace.intentAgent.startsWith("ox.trace.")).toBe(true);
    expect(LfTrace.modifyProject.startsWith("ox.trace.")).toBe(true);
  });

  it("orders generate spans with numeric segments", () => {
    expect(LfSpanGen.fullPipeline.includes(".gen.00_")).toBe(true);
    expect(LfSpanGen.buildVerifyAndRepair.includes(".gen.10_")).toBe(true);
    expect(LfSpanGen.implementPages < LfSpanGen.installDependenciesAfterImplement).toBe(true);
  });

  it("sanitizes dynamic span slugs", () => {
    expect(lfSpanGenPage("home")).toBe("ox.span.gen.06b_page__home");
    expect(lfSpanGenPage("About Us")).toBe("ox.span.gen.06b_page__About_Us");
    expect(lfSpanGenInstallDeps("generated")).toBe("ox.span.gen.08a_install_deps__generated");
  });

  it("exposes intent and modify spans", () => {
    expect(LfSpanIntent.agentTurn.includes(".intent.01_")).toBe(true);
    expect(LfSpanIntent.mergedBriefGeneration.includes(".intent.02_")).toBe(true);
    expect(LfSpanModify.agentLoop.includes(".modify.02_")).toBe(true);
  });
});
