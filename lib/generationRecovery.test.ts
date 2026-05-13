import { describe, expect, it } from "vitest";
import {
  isRecoverableGenerationError,
  recoverableGenerationErrorMessage,
  RECOVERABLE_GENERATION_ERROR_PREFIX,
  stripRecoverablePrefixForDisplay,
} from "./generationRecovery";

describe("generationRecovery", () => {
  it("detects prefixed errors", () => {
    expect(isRecoverableGenerationError(undefined)).toBe(false);
    expect(isRecoverableGenerationError("plain")).toBe(false);
    expect(isRecoverableGenerationError(recoverableGenerationErrorMessage())).toBe(true);
  });

  it("strips display prefix once", () => {
    const full = `${RECOVERABLE_GENERATION_ERROR_PREFIX} hello`;
    expect(stripRecoverablePrefixForDisplay(full)).toBe("hello");
    expect(stripRecoverablePrefixForDisplay("no prefix")).toBe("no prefix");
  });
});
