import { describe, expect, it } from "vitest";
import { httpRetryLimit } from "./gateway";

describe("httpRetryLimit", () => {
  it("gives transient upstream-wrapped 400s a longer retry window", () => {
    expect(httpRetryLimit(400, JSON.stringify({
      error: { code: "bad_response_status_code", type: "upstream_error" },
    }))).toBe(4);
  });

  it("does not retry ordinary argument 400s", () => {
    expect(httpRetryLimit(400, "INVALID_ARGUMENT")).toBe(0);
  });

  it("keeps bounded retries for provider server errors", () => {
    expect(httpRetryLimit(503, "unavailable")).toBe(2);
  });
});
