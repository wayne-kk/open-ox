import { describe, expect, it } from "vitest";
import {
  deriveAcquisitionChannel,
  isExternalReferrer,
  parseAcquisitionFromUrl,
  parseOxAcqCookieValue,
  serializeOxAcqCookieValue,
} from "@/lib/analytics/acquisition";

describe("parseAcquisitionFromUrl", () => {
  it("extracts UTM params, path, and referrer", () => {
    const touch = parseAcquisitionFromUrl({
      href: "https://example.com/zh?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=hero&utm_term=ai&x=1",
      referrer: "https://t.co/abc",
      capturedAt: "2026-07-17T00:00:00.000Z",
      anonymousId: "anon_1",
    });

    expect(touch.utm_source).toBe("twitter");
    expect(touch.utm_medium).toBe("social");
    expect(touch.utm_campaign).toBe("launch");
    expect(touch.utm_content).toBe("hero");
    expect(touch.utm_term).toBe("ai");
    expect(touch.referrer).toBe("https://t.co/abc");
    expect(touch.landing_path).toBe(
      "/zh?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=hero&utm_term=ai&x=1"
    );
    expect(touch.anonymous_id).toBe("anon_1");
    expect(touch.raw.utm_source).toBe("twitter");
  });

  it("returns nullish UTM fields when absent", () => {
    const touch = parseAcquisitionFromUrl({
      href: "https://example.com/",
      referrer: "",
    });
    expect(touch.utm_source).toBeNull();
    expect(touch.referrer).toBeNull();
    expect(touch.landing_path).toBe("/");
  });
});

describe("ox_acq cookie round-trip", () => {
  it("serializes and parses first-touch payload", () => {
    const touch = parseAcquisitionFromUrl({
      href: "https://example.com/?utm_source=google",
      referrer: "https://www.google.com/",
      capturedAt: "2026-07-17T01:00:00.000Z",
      anonymousId: "anon_x",
    });
    const parsed = parseOxAcqCookieValue(serializeOxAcqCookieValue(touch));
    expect(parsed).not.toBeNull();
    expect(parsed?.utm_source).toBe("google");
    expect(parsed?.anonymous_id).toBe("anon_x");
    expect(parsed?.captured_at).toBe("2026-07-17T01:00:00.000Z");
  });

  it("rejects invalid cookie payloads", () => {
    expect(parseOxAcqCookieValue("not-json")).toBeNull();
    expect(
      parseOxAcqCookieValue(encodeURIComponent(JSON.stringify({ utm_source: "x" })))
    ).toBeNull();
  });
});

describe("deriveAcquisitionChannel", () => {
  it("prefers utm over referral", () => {
    expect(
      deriveAcquisitionChannel({
        utm_source: "twitter",
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: "https://t.co/x",
      })
    ).toBe("utm");
  });

  it("uses referral for external referrer without UTM", () => {
    expect(
      deriveAcquisitionChannel(
        {
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null,
          referrer: "https://news.ycombinator.com/",
        },
        "https://open-ox.example"
      )
    ).toBe("referral");
  });

  it("uses direct for same-origin or empty referrer", () => {
    expect(
      deriveAcquisitionChannel(
        {
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null,
          referrer: "https://open-ox.example/pricing",
        },
        "https://open-ox.example"
      )
    ).toBe("direct");
    expect(
      deriveAcquisitionChannel({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: null,
      })
    ).toBe("direct");
  });
});

describe("isExternalReferrer", () => {
  it("detects external hosts", () => {
    expect(isExternalReferrer("https://google.com/", "https://app.example")).toBe(true);
    expect(isExternalReferrer("https://app.example/x", "https://app.example")).toBe(false);
    expect(isExternalReferrer(null, "https://app.example")).toBe(false);
  });
});
