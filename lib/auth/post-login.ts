import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  acquisitionTouchToProperties,
  OX_ACQ_COOKIE,
  parseAcquisitionFromUrl,
  parseOxAcqCookieValue,
} from "@/lib/analytics/acquisition";
import { bindUserAcquisition } from "@/lib/analytics/bindUserAcquisition";
import { AnalyticsEventName } from "@/lib/analytics/catalog";
import { trackServerAnalyticsEvent } from "@/lib/analytics/serverEvents";
import { ensureCreditAccount } from "@/lib/billing/account";

export function resolveAuthAcquisitionTouch(request: NextRequest) {
  const fromCookie = parseOxAcqCookieValue(request.cookies.get(OX_ACQ_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return parseAcquisitionFromUrl({
      href: referer,
      referrer: referer,
    });
  } catch {
    return null;
  }
}

export async function finalizeAuthenticatedLogin(params: {
  request: NextRequest;
  supabase: SupabaseClient;
  user: User;
  provider: string;
}) {
  const touch = resolveAuthAcquisitionTouch(params.request);

  try {
    await bindUserAcquisition({ userId: params.user.id, touch });
  } catch (err) {
    console.warn("[auth] acquisition bind failed:", err instanceof Error ? err.message : err);
  }

  try {
    await ensureCreditAccount(params.supabase, params.user.id);
  } catch (err) {
    console.warn("[auth] credit account ensure failed:", err instanceof Error ? err.message : err);
  }

  await trackServerAnalyticsEvent({
    userId: params.user.id,
    eventName: AnalyticsEventName.authSuccess,
    properties: {
      provider: params.provider,
      ...(touch ? acquisitionTouchToProperties(touch) : {}),
    },
  });
}
