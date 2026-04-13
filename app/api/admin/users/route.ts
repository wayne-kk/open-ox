import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }) };
  }
  const { supabase, user } = session;
  const canEdit = await isAdminUser({ supabase, userId: user.id });
  if (!canEdit) {
    return { error: NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 }) };
  }
  return { supabase, user };
}

interface AuthUserLite {
  id: string;
  email: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
}

function getDisplayName(user: AuthUserLite): string {
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  const preferred = typeof meta.preferred_username === "string" ? meta.preferred_username.trim() : "";
  if (preferred) return preferred;
  if (user.email) return user.email.split("@")[0];
  return user.id.slice(0, 8);
}

async function listAllUsers() {
  const service = createSupabaseServiceRoleClient();
  const users: AuthUserLite[] = [];
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const current = (data?.users ?? []) as AuthUserLite[];
    users.push(...current);
    if (current.length < perPage) break;
  }
  return users;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const service = createSupabaseServiceRoleClient();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPageRaw = Number.parseInt(searchParams.get("perPage") ?? "10", 10) || 10;
  const perPage = Math.max(1, Math.min(perPageRaw, 50));

  const { data: rows, error } = await service
    .from("user_roles")
    .select("user_id, role, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allUsers = await listAllUsers();
  const usersWithName = allUsers.map((user) => ({
    userId: user.id,
    email: user.email ?? null,
    name: getDisplayName(user),
    createdAt: user.created_at ?? null,
  }));

  const filtered = q
    ? usersWithName.filter((user) => {
        const haystack = `${user.name} ${user.email ?? ""} ${user.userId}`.toLowerCase();
        return haystack.includes(q);
      })
    : usersWithName;

  const sorted = filtered.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const users = sorted.slice(start, start + perPage);

  const admins = await Promise.all(
    (rows ?? []).map(async (row) => {
      const userId = (row as { user_id: string }).user_id;
      const userResp = await service.auth.admin.getUserById(userId);
      const authUser = userResp.data.user;
      return {
        userId,
        role: "admin",
        createdAt: (row as { created_at: string }).created_at,
        email: authUser?.email ?? null,
        name: authUser
          ? getDisplayName({
              id: authUser.id,
              email: authUser.email ?? null,
              created_at: authUser.created_at,
              user_metadata: authUser.user_metadata,
            })
          : userId.slice(0, 8),
      };
    })
  );

  return NextResponse.json({
    me: auth.user.id,
    admins,
    users,
    pagination: {
      q,
      page: currentPage,
      perPage,
      total,
      totalPages,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
  if (!userId && !name) {
    return NextResponse.json({ error: "userId or name required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const allUsers = await listAllUsers();
  let match: AuthUserLite | undefined;
  if (userId) {
    match = allUsers.find((u) => u.id === userId);
    if (!match) {
      return NextResponse.json({ error: "User not found by userId" }, { status: 404 });
    }
  } else {
    const matches = allUsers.filter((u) => {
      const displayName = getDisplayName({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        user_metadata: u.user_metadata,
      }).toLowerCase();
      return displayName === name;
    });
    if (matches.length === 0) {
      return NextResponse.json({ error: "User not found by name" }, { status: 404 });
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { error: `Multiple users matched this name (${matches.length}). Please use a unique name.` },
        { status: 409 }
      );
    }
    match = matches[0];
  }

  const { error: upsertError } = await service.from("user_roles").upsert({
    user_id: match.id,
    role: "admin",
  });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    userId: match.id,
    name: getDisplayName({
      id: match.id,
      email: match.email ?? null,
      created_at: match.created_at,
      user_metadata: match.user_metadata,
    }),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself from admin role" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
