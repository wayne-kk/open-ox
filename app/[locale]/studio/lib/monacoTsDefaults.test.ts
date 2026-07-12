import { describe, expect, it } from "vitest";
import { MONACO_REACT_JSX_STUB } from "./monacoTsDefaults";

describe("monacoTsDefaults stubs", () => {
  it("declares react/jsx-runtime so TS2875 can resolve", () => {
    expect(MONACO_REACT_JSX_STUB).toContain('declare module "react/jsx-runtime"');
    expect(MONACO_REACT_JSX_STUB).toContain("export function jsx");
    expect(MONACO_REACT_JSX_STUB).toContain("declare namespace JSX");
    expect(MONACO_REACT_JSX_STUB).toContain("IntrinsicElements");
  });
});
