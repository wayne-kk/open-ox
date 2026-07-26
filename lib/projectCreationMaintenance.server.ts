import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const SETTING_KEY = "project_creation_maintenance";

export async function isProjectCreationMaintenance(): Promise<boolean> {
  try {
    const database = createSupabaseServiceRoleClient();
    const { data, error } = await database
      .from("system_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.error("[project creation maintenance] read failed:", error.message);
      return true;
    }

    return data?.value !== false;
  } catch (error) {
    console.error("[project creation maintenance] unavailable:", error);
    return true;
  }
}

export async function setProjectCreationMaintenance(params: {
  enabled: boolean;
  adminUserId: string;
}): Promise<void> {
  const database = createSupabaseServiceRoleClient();
  const { error } = await database.from("system_settings").upsert(
    {
      key: SETTING_KEY,
      value: params.enabled,
      updated_at: new Date().toISOString(),
      updated_by: params.adminUserId,
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}
