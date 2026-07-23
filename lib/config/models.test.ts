import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceRoleClient } = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseServiceRoleClient }));

import {
  clearStepModels,
  beginModelRuntimeContext,
  getAllModels,
  getModelForStep,
  getStepModel,
  loadStepModelsFromDB,
  removeModelConfig,
  setConfiguredStepModel,
  setCustomModels,
} from "./models";

describe("loadStepModelsFromDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStepModels();
    setCustomModels([]);
  });

  it("loads global model configuration through the service-role client", async () => {
    const customModels = [
      {
        id: "gemini-3.5-flash",
        display_name: "Gemini 3.5 Flash",
        context_window: 128_000,
        supports_thinking: true,
        input_price_per_mtok: "0.2",
        output_price_per_mtok: "0.8",
      },
    ];
    const stepModels = [
      {
        step_name: "page_implement_agent",
        model_id: "gemini-3.5-flash",
        thinking_level: "low",
      },
    ];
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockResolvedValue({
        data: table === "model_configs" ? customModels : stepModels,
        error: null,
      }),
    }));
    createSupabaseServiceRoleClient.mockReturnValue({ from });

    await loadStepModelsFromDB();

    expect(createSupabaseServiceRoleClient).toHaveBeenCalledOnce();
    expect(getStepModel("page_implement_agent")).toBe("gemini-3.5-flash");
    expect(getModelForStep("page_implement_agent")).toBe("gemini-3.5-flash");
    expect(getAllModels()).toContainEqual(
      expect.objectContaining({
        id: "gemini-3.5-flash",
        supportsThinking: true,
        tokenPrice: { inputPerMTok: 0.2, outputPerMTok: 0.8 },
      }),
    );

    // Cached loads leave the current run's transient override intact.
    const { setStepModel } = await import("./models");
    setStepModel("page_implement_agent", "gemini-3-flash-preview");
    await loadStepModelsFromDB();
    expect(getStepModel("page_implement_agent")).toBe("gemini-3-flash-preview");
    expect(createSupabaseServiceRoleClient).toHaveBeenCalledOnce();
  });

  it("isolates transient step overrides between concurrent async runs", async () => {
    const { setStepModel } = await import("./models");
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = Promise.resolve().then(async () => {
      beginModelRuntimeContext();
      setStepModel("page_implement_agent", "fast-model");
      await firstCanFinish;
      return getStepModel("page_implement_agent");
    });
    const second = Promise.resolve().then(async () => {
      beginModelRuntimeContext();
      setStepModel("page_implement_agent", "deep-model");
      await Promise.resolve();
      return getStepModel("page_implement_agent");
    });

    expect(await second).toBe("deep-model");
    releaseFirst();
    expect(await first).toBe("fast-model");
  });

  it("removes a deleted model and its cached step assignments", () => {
    setCustomModels([{ id: "custom-model", displayName: "Custom", contextWindow: 128_000 }]);
    setConfiguredStepModel("page_implement_agent", "custom-model");

    removeModelConfig("custom-model");

    expect(getAllModels()).not.toContainEqual(expect.objectContaining({ id: "custom-model" }));
    expect(getStepModel("page_implement_agent")).toBeNull();
  });
});
