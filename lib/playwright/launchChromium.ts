/**
 * Shared Playwright Chromium launch for cover capture and reference-page capture.
 * Honors PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH; relaxes sandbox when running non-root.
 */

import { chromium, type Browser, type LaunchOptions } from "playwright";

const NON_ROOT_SANDBOX_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"] as const;
/** Avoid Chromium crashes when /dev/shm is small. */
const DOCKER_SHM_ARG = "--disable-dev-shm-usage";

/** Pure options builder — unit-tested without launching a browser. */
export function buildChromiumLaunchOptions(overrides?: LaunchOptions): LaunchOptions {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  const mergedArgs = [...(overrides?.args ?? [])];
  if (!mergedArgs.includes(DOCKER_SHM_ARG)) {
    mergedArgs.push(DOCKER_SHM_ARG);
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  if (uid !== 0) {
    for (const arg of NON_ROOT_SANDBOX_ARGS) {
      if (!mergedArgs.includes(arg)) mergedArgs.push(arg);
    }
  }

  return {
    headless: true,
    ...overrides,
    ...(executablePath ? { executablePath } : {}),
    ...(mergedArgs.length > 0 ? { args: mergedArgs } : {}),
  };
}

export async function launchChromium(overrides?: LaunchOptions): Promise<Browser> {
  return chromium.launch(buildChromiumLaunchOptions(overrides));
}
