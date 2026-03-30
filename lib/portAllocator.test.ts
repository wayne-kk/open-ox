import { describe, it, expect } from "vitest";
import * as net from "net";
import { findAvailablePort } from "./portAllocator";

/**
 * Helper: bind a server to a port and keep it open until the returned cleanup fn is called.
 */
function occupyPort(port: number): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve(
        () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          )
      );
    });
  });
}

describe("findAvailablePort", () => {
  it("returns 3100 when no ports are occupied", async () => {
    const port = await findAvailablePort();
    expect(port).toBe(3100);
  });

  it("skips occupied ports and returns the next free one", async () => {
    const release3100 = await occupyPort(3100);
    try {
      const port = await findAvailablePort();
      expect(port).toBe(3101);
    } finally {
      await release3100();
    }
  });

  it("respects a custom startPort", async () => {
    const port = await findAvailablePort(3150);
    expect(port).toBe(3150);
  });

  it("throws when no port is available in range", async () => {
    // Occupy every port from 3100 to 3200
    const releases: Array<() => Promise<void>> = [];
    for (let p = 3100; p <= 3200; p++) {
      releases.push(await occupyPort(p));
    }
    try {
      await expect(findAvailablePort()).rejects.toThrow(
        "No available port found in range 3100-3200"
      );
    } finally {
      await Promise.all(releases.map((r) => r()));
    }
  });
});
