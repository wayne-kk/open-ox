import { describe, expect, it } from "vitest";
import {
  coerceStoredProductionUrl,
  deriveStableVercelAppHost,
  isDeploymentSpecificVercelHost,
  pickStableProductionUrl,
  productionUrlFromDeployment,
} from "./productionUrl";

describe("deriveStableVercelAppHost", () => {
  it("strips deployment hash for team-scoped production URL", () => {
    expect(
      deriveStableVercelAppHost(
        "open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
        "open-ox-4323abfa"
      )
    ).toBe("open-ox-4323abfa-open-ox.vercel.app");
  });

  it("leaves stable production host unchanged", () => {
    expect(
      deriveStableVercelAppHost(
        "https://open-ox-4323abfa-open-ox.vercel.app/",
        "open-ox-4323abfa"
      )
    ).toBe("open-ox-4323abfa-open-ox.vercel.app");
  });

  it("accepts https URL input", () => {
    expect(
      deriveStableVercelAppHost(
        "https://open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
        "open-ox-4323abfa"
      )
    ).toBe("open-ox-4323abfa-open-ox.vercel.app");
  });
});

describe("pickStableProductionUrl", () => {
  it("prefers alias over unique deployment url", () => {
    expect(
      pickStableProductionUrl(
        [
          "open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
          "open-ox-4323abfa-open-ox.vercel.app",
        ],
        { projectName: "open-ox-4323abfa" }
      )
    ).toBe("https://open-ox-4323abfa-open-ox.vercel.app");
  });

  it("coerces deployment url when only url is present", () => {
    expect(
      pickStableProductionUrl(["https://open-ox-4323abfa-5j39601rm-open-ox.vercel.app"], {
        projectName: "open-ox-4323abfa",
      })
    ).toBe("https://open-ox-4323abfa-open-ox.vercel.app");
  });

  it("prefers custom domain", () => {
    expect(
      pickStableProductionUrl(
        ["open-ox-4323abfa-open-ox.vercel.app", "www.popmart.example"],
        { projectName: "open-ox-4323abfa" }
      )
    ).toBe("https://www.popmart.example");
  });
});

describe("productionUrlFromDeployment", () => {
  it("uses aliases when present", () => {
    expect(
      productionUrlFromDeployment(
        {
          url: "open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
          alias: ["open-ox-4323abfa-open-ox.vercel.app"],
        },
        { projectName: "open-ox-4323abfa" }
      )
    ).toBe("https://open-ox-4323abfa-open-ox.vercel.app");
  });

  it("falls back to coerced deployment url", () => {
    expect(
      productionUrlFromDeployment(
        { url: "open-ox-4323abfa-5j39601rm-open-ox.vercel.app" },
        { projectName: "open-ox-4323abfa" }
      )
    ).toBe("https://open-ox-4323abfa-open-ox.vercel.app");
  });
});

describe("coerceStoredProductionUrl", () => {
  it("rewrites previously stored deployment-specific urls", () => {
    expect(
      coerceStoredProductionUrl(
        "https://open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
        "open-ox-4323abfa"
      )
    ).toBe("https://open-ox-4323abfa-open-ox.vercel.app");
  });

  it("returns null for empty", () => {
    expect(coerceStoredProductionUrl(null, "x")).toBeNull();
  });
});

describe("isDeploymentSpecificVercelHost", () => {
  it("detects unique deployment host when project name known", () => {
    expect(
      isDeploymentSpecificVercelHost(
        "open-ox-4323abfa-5j39601rm-open-ox.vercel.app",
        "open-ox-4323abfa"
      )
    ).toBe(true);
    expect(
      isDeploymentSpecificVercelHost(
        "open-ox-4323abfa-open-ox.vercel.app",
        "open-ox-4323abfa"
      )
    ).toBe(false);
  });
});
