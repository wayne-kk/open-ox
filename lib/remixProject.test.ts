import { describe, expect, it } from "vitest";
import { shouldExcludeFromRemix } from "@/lib/remixProject";

describe("shouldExcludeFromRemix", () => {
  it("excludes env and secrets", () => {
    expect(shouldExcludeFromRemix(".env")).toBe(true);
    expect(shouldExcludeFromRemix(".env.local")).toBe(true);
    expect(shouldExcludeFromRemix("config/.env.production")).toBe(true);
    expect(shouldExcludeFromRemix("certs/server.pem")).toBe(true);
  });

  it("excludes build/vendor dirs", () => {
    expect(shouldExcludeFromRemix("node_modules/foo")).toBe(true);
    expect(shouldExcludeFromRemix(".next/cache")).toBe(true);
    expect(shouldExcludeFromRemix("out/index.html")).toBe(true);
  });

  it("keeps normal source files", () => {
    expect(shouldExcludeFromRemix("app/page.tsx")).toBe(false);
    expect(shouldExcludeFromRemix("package.json")).toBe(false);
  });
});
