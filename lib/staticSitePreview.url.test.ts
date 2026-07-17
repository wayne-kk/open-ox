import { describe, expect, it } from "vitest";
import { getStaticPreviewUrl, getStoragePreviewPublicObjectUrl } from "./staticSitePreview";

describe("getStaticPreviewUrl", () => {
  it("returns proxy URL without trailing slash", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example";
    delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    try {
      expect(getStaticPreviewUrl("2026-07-12T04-52-26-826Z_project")).toBe(
        "https://app.example/site-previews/2026-07-12T04-52-26-826Z_project"
      );
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });

  it("uses dedicated preview origin root path when configured", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "https://p.example";
    try {
      expect(getStaticPreviewUrl("2026-07-12T04-52-26-826Z_project")).toBe(
        `https://p.example/${encodeURIComponent("2026-07-12T04-52-26-826Z_project")}`
      );
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });
});

describe("getStoragePreviewPublicObjectUrl", () => {
  it("builds encoded public object URL under site-previews bucket", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    try {
      expect(getStoragePreviewPublicObjectUrl("p1", "index.html")).toBe(
        "https://abc.supabase.co/storage/v1/object/public/site-previews/p/p1/index.html"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });
});
