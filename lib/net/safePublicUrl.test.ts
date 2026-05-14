import { describe, expect, it } from "vitest";
import { assertUrlSafeForServerFetch } from "./safePublicUrl";

describe("assertUrlSafeForServerFetch", () => {
  it("rejects localhost", async () => {
    await expect(assertUrlSafeForServerFetch("http://localhost/foo")).rejects.toThrow();
  });

  it("rejects loopback ipv4 literal", async () => {
    await expect(assertUrlSafeForServerFetch("http://127.0.0.1/")).rejects.toThrow();
  });

  it("rejects non-http protocols", async () => {
    await expect(assertUrlSafeForServerFetch("file:///etc/passwd")).rejects.toThrow();
  });

  it("accepts public https hostnames (DNS)", async () => {
    await expect(assertUrlSafeForServerFetch("https://example.com/")).resolves.toMatchObject({
      hostname: "example.com",
    });
  });
});
