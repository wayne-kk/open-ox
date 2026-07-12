import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type AuthUserLite = {
  id: string;
  email: string | null;
  created_at: string;
};

type AuthAdminUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

/**
 * Paginate Supabase Auth admin users until exhausted (no silent page cap).
 */
export async function listAllAuthAdminUsers(): Promise<AuthAdminUser[]> {
  const service = createSupabaseServiceRoleClient();
  const users: AuthAdminUser[] = [];
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const current = (data?.users ?? []) as AuthAdminUser[];
    users.push(...current);
    if (current.length < perPage) break;
  }
  return users;
}

export async function listAllAuthUsers(): Promise<AuthUserLite[]> {
  const users = await listAllAuthAdminUsers();
  return users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at ?? new Date(0).toISOString(),
  }));
}
