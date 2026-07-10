import { describe, expect, it, vi } from "vitest";
import {
  APP_RETURN_TO_KEY,
  captureAppReturnTo,
  clearAppReturnTo,
  isSafeInternalPath,
  navigateAppBack,
  peekAppReturnTo,
} from "./appBack";

describe("isSafeInternalPath", () => {
  it("allows app routes with query strings", () => {
    expect(isSafeInternalPath("/dashboard?mine=1&folder=all")).toBe(true);
    expect(isSafeInternalPath("/projects?mine=1&folder=all")).toBe(true);
    expect(isSafeInternalPath("/studio/abc-123")).toBe(true);
    expect(isSafeInternalPath("/")).toBe(true);
  });

  it("rejects external and malformed paths", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("/unknown-zone")).toBe(false);
  });
});

describe("captureAppReturnTo + navigateAppBack", () => {
  it("migrates legacy /projects list URLs to /dashboard", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
    });
    vi.stubGlobal("window", { history: { length: 5 } });

    captureAppReturnTo("/projects?mine=1&folder=work");

    const back = vi.fn();
    const push = vi.fn();
    navigateAppBack({ back, push });

    expect(push).toHaveBeenCalledWith("/dashboard?mine=1&folder=work");
    expect(back).not.toHaveBeenCalled();
    expect(peekAppReturnTo()).toBeNull();
    expect(storage.has(APP_RETURN_TO_KEY)).toBe(false);

    vi.unstubAllGlobals();
  });

  it("falls back to router.back when no stored path", () => {
    clearAppReturnTo();
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("window", { history: { length: 3 } });

    const back = vi.fn();
    const push = vi.fn();
    navigateAppBack({ back, push });

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("uses fallback when history is empty", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("window", { history: { length: 1 } });

    const back = vi.fn();
    const push = vi.fn();
    navigateAppBack({ back, push }, { fallback: "/dashboard" });

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(back).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
