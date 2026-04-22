import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function createServerSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are required"
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

let cached: SupabaseClient | null = null;

function getServerSupabase(): SupabaseClient {
  if (!cached) {
    cached = createServerSupabase();
  }
  return cached;
}

/**
 * Server-side client (API routes / server actions only).
 * Lazily created so `next build` can load importing modules without env; first use still requires env.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getServerSupabase();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
