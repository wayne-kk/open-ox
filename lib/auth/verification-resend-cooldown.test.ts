import { describe, expect, it } from "vitest";
import {
  readVerificationResendState,
  verificationResendSecondsRemaining,
  writeVerificationResendState,
} from "./verification-resend-cooldown";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("verification resend cooldown", () => {
  it("persists the email and absolute resend deadline", () => {
    const storage = memoryStorage();
    const state = { email: "anna@example.com", resendAvailableAt: 61_000 };

    writeVerificationResendState(storage, state);

    expect(readVerificationResendState(storage)).toEqual(state);
    expect(verificationResendSecondsRemaining(state.resendAvailableAt, 1_000)).toBe(60);
  });

  it("expires at zero instead of returning negative time", () => {
    expect(verificationResendSecondsRemaining(1_000, 1_001)).toBe(0);
  });
});
