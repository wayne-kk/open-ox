import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("locale routing SEO headers", () => {
  it("does not emit alternate links that can conflict with page metadata", () => {
    expect(routing.alternateLinks).toBe(false);
  });
});
