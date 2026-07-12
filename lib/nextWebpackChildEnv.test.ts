import { describe, expect, it } from "vitest";
import { envForNextWebpackChild } from "./nextWebpackChildEnv";

describe("envForNextWebpackChild", () => {
  it("strips turbopack flags inherited from Studio next dev", () => {
    const prev = {
      TURBOPACK: process.env.TURBOPACK,
      TURBO: process.env.TURBO,
      NEXT_TURBOPACK: process.env.NEXT_TURBOPACK,
    };
    process.env.TURBOPACK = "1";
    process.env.TURBO = "1";
    process.env.NEXT_TURBOPACK = "1";
    try {
      const env = envForNextWebpackChild({ NODE_ENV: "production" });
      expect(env.TURBOPACK).toBeUndefined();
      expect(env.TURBO).toBeUndefined();
      expect(env.NEXT_TURBOPACK).toBeUndefined();
      expect(env.NODE_ENV).toBe("production");
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
