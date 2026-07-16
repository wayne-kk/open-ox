import type { AcquisitionTouch } from "@/lib/analytics/acquisition";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/** Write-once first-touch row for a user. Server-only (service role). */
export async function bindUserAcquisition(params: {
  userId: string;
  touch: AcquisitionTouch | null;
}): Promise<{ bound: boolean; touch: AcquisitionTouch | null }> {
  if (!params.touch) {
    return { bound: false, touch: null };
  }

  const service = createSupabaseServiceRoleClient();
  const row = {
    user_id: params.userId,
    utm_source: params.touch.utm_source,
    utm_medium: params.touch.utm_medium,
    utm_campaign: params.touch.utm_campaign,
    utm_content: params.touch.utm_content,
    utm_term: params.touch.utm_term,
    referrer: params.touch.referrer,
    landing_path: params.touch.landing_path,
    captured_at: params.touch.captured_at,
    bound_at: new Date().toISOString(),
    anonymous_id: params.touch.anonymous_id,
    raw: params.touch.raw,
  };

  const { error } = await service.from("user_acquisition").insert(row);
  if (error) {
    if (error.code === "23505") {
      return { bound: false, touch: params.touch };
    }
    console.warn("[analytics] bindUserAcquisition failed:", error.message);
    return { bound: false, touch: params.touch };
  }

  return { bound: true, touch: params.touch };
}
