import { afterEach, describe, expect, it, vi } from "vitest";

import { generationRedisUrl } from "./generationQueue";

describe("generationRedisUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the private Redis on the application host", () => {
    vi.stubEnv("REDIS_URL", "");
    expect(generationRedisUrl()).toBe("redis://127.0.0.1:6379");
  });

  it("uses an explicitly configured Redis endpoint", () => {
    vi.stubEnv("REDIS_URL", "redis://redis.internal:6379");
    expect(generationRedisUrl()).toBe("redis://redis.internal:6379");
  });
});
