import { afterEach, describe, expect, it, vi } from "vitest";
import {
  shouldRunInlineGeneration,
  shouldRunStandaloneGenerationWorker,
} from "./inlineGeneration";

describe("generation executor mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prevents the standalone worker from claiming runs in inline mode", () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");

    expect(shouldRunInlineGeneration()).toBe(true);
    expect(shouldRunStandaloneGenerationWorker()).toBe(false);
  });

  it("uses the standalone worker when inline mode is disabled", () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "0");

    expect(shouldRunInlineGeneration()).toBe(false);
    expect(shouldRunStandaloneGenerationWorker()).toBe(true);
  });
});
