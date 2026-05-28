import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import { createSupabaseServiceRoleClient } from "./supabase/service-role";

let cachedAdmin: SupabaseClient | null | undefined;

/**
 * Prefer service role for `project-files` bucket I/O (private bucket + `.open-ox/*` snapshots).
 * Falls back to the publishable server client when SERVICE_ROLE is unset (local dev without full env).
 */
export function getProjectFilesStorageClient(): SupabaseClient {
  if (cachedAdmin !== undefined) {
    return cachedAdmin ?? supabase;
  }
  try {
    cachedAdmin = createSupabaseServiceRoleClient();
    return cachedAdmin;
  } catch {
    cachedAdmin = null;
    return supabase;
  }
}
