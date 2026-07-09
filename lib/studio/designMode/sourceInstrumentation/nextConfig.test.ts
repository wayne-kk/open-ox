import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const templateNextConfig = path.join(process.cwd(), "sites/template/next.config.ts");

describe("template source instrumentation webpack rule", () => {
  it("matches ordinary tsx/jsx extensions", () => {
    const config = fs.readFileSync(templateNextConfig, "utf-8");
    expect(config).toContain("source-instrumentation-loader.cjs");
    expect(config).toContain("test: /\\.[jt]sx$/");
    expect(config).not.toContain("test: /\\\\.[jt]sx$/");
  });
});
