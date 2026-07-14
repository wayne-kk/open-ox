import { afterEach, describe, expect, it } from "vitest";

import { buildChromiumLaunchOptions } from "./launchChromium";

describe("buildChromiumLaunchOptions", () => {
  const prevPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

  afterEach(() => {
    if (prevPath === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = prevPath;
  });

  it("sets headless and honors PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", () => {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/usr/bin/chromium";
    const opts = buildChromiumLaunchOptions();
    expect(opts.headless).toBe(true);
    expect(opts.executablePath).toBe("/usr/bin/chromium");
  });

  it("always adds --disable-dev-shm-usage for small Docker /dev/shm", () => {
    const opts = buildChromiumLaunchOptions();
    expect(opts.args).toEqual(expect.arrayContaining(["--disable-dev-shm-usage"]));
  });

  it("adds sandbox args when process is non-root", () => {
    const getuid = process.getuid;
    if (typeof getuid !== "function") return;
    if (getuid() === 0) return;

    const opts = buildChromiumLaunchOptions();
    expect(opts.args).toEqual(
      expect.arrayContaining([
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ])
    );
  });

  it("merges caller args without duplicating sandbox flags", () => {
    const getuid = process.getuid;
    if (typeof getuid !== "function" || getuid() === 0) return;

    const opts = buildChromiumLaunchOptions({ args: ["--no-sandbox", "--disable-gpu"] });
    expect(opts.args?.filter((a) => a === "--no-sandbox")).toHaveLength(1);
    expect(opts.args).toEqual(expect.arrayContaining(["--disable-gpu", "--disable-setuid-sandbox"]));
  });
});
