import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOME_PAGE_TSX,
  isPreparingSiteHomePageStub,
  PREPARING_SITE_HOME_PAGE_MARKER,
} from "./preparingSiteHomePageStub";

describe("isPreparingSiteHomePageStub", () => {
  it("detects the init/default home page", () => {
    expect(isPreparingSiteHomePageStub(DEFAULT_HOME_PAGE_TSX)).toBe(true);
    expect(DEFAULT_HOME_PAGE_TSX).toContain(PREPARING_SITE_HOME_PAGE_MARKER);
  });

  it("rejects a real generated home page", () => {
    expect(
      isPreparingSiteHomePageStub(`import Hero from "@/components/home/Hero";
export default function HomePage() {
  return <Hero />;
}
`)
    ).toBe(false);
  });
});
