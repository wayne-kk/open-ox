import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdminUser(params: {
  supabase: SupabaseClient;
  userId: string;
  throwOnError?: boolean;
}): Promise<boolean> {
  const { supabase, userId, throwOnError = false } = params;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) {
    if (throwOnError) throw error;
    console.warn("[roles] admin lookup failed:", error.message);
    return false;
  }
  return !!data;
}
