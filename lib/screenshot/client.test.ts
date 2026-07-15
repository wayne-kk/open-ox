import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureCoverViewportJpeg,
  captureReferencePage,
  getScreenshotServiceBaseUrl,
} from "./client";

describe("screenshot client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults base URL to localhost:3921", () => {
    vi.stubEnv("OPEN_OX_SCREENSHOT_URL", "");
    expect(getScreenshotServiceBaseUrl()).toBe("http://127.0.0.1:3921");
  });

  it("strips trailing slash from OPEN_OX_SCREENSHOT_URL", () => {
    vi.stubEnv("OPEN_OX_SCREENSHOT_URL", "http://127.0.0.1:3999/");
    expect(getScreenshotServiceBaseUrl()).toBe("http://127.0.0.1:3999");
  });

  it("captureCoverViewportJpeg posts JSON and returns jpeg bytes", async () => {
    vi.stubEnv("OPEN_OX_SCREENSHOT_SECRET", "test-secret");
    vi.stubEnv("OPEN_OX_SCREENSHOT_URL", "http://127.0.0.1:3921");

    const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await captureCoverViewportJpeg({
      url: "http://127.0.0.1:3000/site-previews/p1/",
      extraHeaders: { "x-open-ox-preview-capture": "cap" },
      polish: true,
    });

    expect(Buffer.from(out)).toEqual(jpeg);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://127.0.0.1:3921/v1/cover-viewport");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(String(init.body))).toEqual({
      url: "http://127.0.0.1:3000/site-previews/p1/",
      extraHeaders: { "x-open-ox-preview-capture": "cap" },
      polish: true,
    });
  });

  it("captureCoverViewportJpeg throws when secret missing", async () => {
    vi.stubEnv("OPEN_OX_SCREENSHOT_SECRET", "");
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "");
    await expect(
      captureCoverViewportJpeg({ url: "http://example.com/" })
    ).rejects.toThrow(/OPEN_OX_SCREENSHOT_SECRET|OPEN_OX_PREVIEW_CAPTURE_SECRET/);
  });

  it("captureReferencePage returns JSON body", async () => {
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "from-preview");
    const payload = {
      ok: true as const,
      finalUrl: "https://example.com/",
      pageTitle: "Ex",
      pngBase64: "abc",
      visibleText: "hi",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await captureReferencePage("https://example.com/");
    expect(out).toEqual(payload);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:3921/v1/reference-page");
  });

  it("captureReferencePage maps HTTP errors to ok:false", async () => {
    vi.stubEnv("OPEN_OX_SCREENSHOT_SECRET", "s");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "boom" }),
      })
    );

    const out = await captureReferencePage("https://example.com/");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/boom/);
  });
});
