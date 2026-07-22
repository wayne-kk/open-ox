import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

describe("production OAuth environment", () => {
  it.each([
    "LINUXDO_CLIENT_ID",
    "LINUXDO_CLIENT_SECRET",
    "LINUXDO_OAUTH_HMAC_SECRET",
  ])("writes %s from GitHub Secrets", (key) => {
    const secretExpression = "${{ secrets." + key + " }}";
    expect(workflow).toContain(`echo "${key}=${secretExpression}"`);
  });
});
