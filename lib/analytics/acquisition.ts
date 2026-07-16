import type { AcquisitionChannel, AcquisitionProperties } from "@/lib/analytics/catalog";

export const OX_ACQ_COOKIE = "ox_acq";
const COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const MAX_TEXT = 512;
const MAX_PATH = 512;
const MAX_REFERRER = 1024;

export type AcquisitionTouch = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
  captured_at: string;
  anonymous_id: string | null;
  raw: Record<string, string>;
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function cleanParam(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return truncate(trimmed, MAX_TEXT);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hostOf(urlLike: string | null | undefined): string | null {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function isExternalReferrer(
  referrer: string | null | undefined,
  pageOrigin?: string | null
): boolean {
  const refHost = hostOf(referrer ?? null);
  if (!refHost) return false;
  if (!pageOrigin) return true;
  const pageHost = hostOf(pageOrigin);
  if (!pageHost) return true;
  return refHost !== pageHost;
}

export function deriveAcquisitionChannel(
  touch: Pick<
    AcquisitionTouch,
    "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "referrer"
  >,
  pageOrigin?: string | null
): AcquisitionChannel {
  if (
    touch.utm_source ||
    touch.utm_medium ||
    touch.utm_campaign ||
    touch.utm_content ||
    touch.utm_term
  ) {
    return "utm";
  }
  if (isExternalReferrer(touch.referrer, pageOrigin)) return "referral";
  return "direct";
}

export function acquisitionTouchToProperties(touch: AcquisitionTouch): AcquisitionProperties {
  return {
    utm_source: touch.utm_source,
    utm_medium: touch.utm_medium,
    utm_campaign: touch.utm_campaign,
    utm_content: touch.utm_content,
    utm_term: touch.utm_term,
    referrer: touch.referrer,
    landing_path: touch.landing_path,
  };
}

export function parseAcquisitionFromUrl(params: {
  href: string;
  referrer?: string | null;
  capturedAt?: string;
  anonymousId?: string | null;
}): AcquisitionTouch {
  let url: URL;
  try {
    url = new URL(params.href);
  } catch {
    url = new URL("https://invalid.local/");
  }

  const raw: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const value = url.searchParams.get(key);
    if (value != null && value.trim()) raw[key] = truncate(value.trim(), MAX_TEXT);
  }

  const referrer = cleanParam(params.referrer ?? null);
  const landingPath = truncate(`${url.pathname}${url.search}` || "/", MAX_PATH);

  return {
    utm_source: cleanParam(url.searchParams.get("utm_source")),
    utm_medium: cleanParam(url.searchParams.get("utm_medium")),
    utm_campaign: cleanParam(url.searchParams.get("utm_campaign")),
    utm_content: cleanParam(url.searchParams.get("utm_content")),
    utm_term: cleanParam(url.searchParams.get("utm_term")),
    referrer: referrer ? truncate(referrer, MAX_REFERRER) : null,
    landing_path: landingPath,
    captured_at: params.capturedAt ?? new Date().toISOString(),
    anonymous_id: cleanParam(params.anonymousId ?? null),
    raw,
  };
}

export function parseOxAcqCookieValue(raw: string | null | undefined): AcquisitionTouch | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;

  const capturedAt =
    typeof parsed.captured_at === "string" && !Number.isNaN(Date.parse(parsed.captured_at))
      ? parsed.captured_at
      : null;
  if (!capturedAt) return null;

  const rawObj = isPlainObject(parsed.raw)
    ? Object.fromEntries(
        Object.entries(parsed.raw)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string")
          .map(([key, value]) => [key, truncate(value, MAX_TEXT)])
      )
    : {};

  return {
    utm_source: cleanParam(typeof parsed.utm_source === "string" ? parsed.utm_source : null),
    utm_medium: cleanParam(typeof parsed.utm_medium === "string" ? parsed.utm_medium : null),
    utm_campaign: cleanParam(typeof parsed.utm_campaign === "string" ? parsed.utm_campaign : null),
    utm_content: cleanParam(typeof parsed.utm_content === "string" ? parsed.utm_content : null),
    utm_term: cleanParam(typeof parsed.utm_term === "string" ? parsed.utm_term : null),
    referrer: cleanParam(typeof parsed.referrer === "string" ? parsed.referrer : null),
    landing_path: cleanParam(typeof parsed.landing_path === "string" ? parsed.landing_path : null),
    captured_at: capturedAt,
    anonymous_id: cleanParam(typeof parsed.anonymous_id === "string" ? parsed.anonymous_id : null),
    raw: rawObj,
  };
}

export function serializeOxAcqCookieValue(touch: AcquisitionTouch): string {
  return encodeURIComponent(JSON.stringify(touch));
}

export function readOxAcqCookie(): AcquisitionTouch | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${OX_ACQ_COOKIE}=`));
  if (!match) return null;
  return parseOxAcqCookieValue(match.slice(OX_ACQ_COOKIE.length + 1));
}

export function writeOxAcqCookie(touch: AcquisitionTouch): void {
  if (typeof document === "undefined") return;
  const value = serializeOxAcqCookieValue(touch);
  document.cookie = `${OX_ACQ_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/**
 * First-touch capture: write ox_acq once if absent. Returns the touch when newly written.
 */
export function captureClientAcquisition(params?: {
  href?: string;
  referrer?: string | null;
  anonymousId?: string | null;
}): AcquisitionTouch | null {
  if (typeof window === "undefined") return null;
  const existing = readOxAcqCookie();
  if (existing) return null;

  const touch = parseAcquisitionFromUrl({
    href: params?.href ?? window.location.href,
    referrer: params?.referrer ?? document.referrer,
    anonymousId: params?.anonymousId ?? null,
  });
  writeOxAcqCookie(touch);
  return touch;
}
