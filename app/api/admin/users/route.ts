import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchCachedAdminUserDirectory } from "@/lib/admin/analytics/cachedQueries";
import { invalidateAnalyticsAudienceCache } from "@/lib/admin/analytics/dataLoader";
import { listAllAuthAdminUsers } from "@/lib/admin/analytics/authUsers";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import {
  getDisplayName,
  type UserActivityStatus,
} from "@/lib/admin/userDirectory";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

function parseActivityStatus(raw: string | null): UserActivityStatus | "all" {
  if (
    raw === "active" ||
    raw === "silent" ||
    raw === "churned" ||
    raw === "never"
  )
    return raw;
  return "all";
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const perPageRaw =
    Number.parseInt(searchParams.get("perPage") ?? "20", 10) || 20;
  const perPage = Math.max(1, Math.min(perPageRaw, 50));
  const roleRaw = searchParams.get("role") ?? "all";
  const role = roleRaw === "admin" || roleRaw === "member" ? roleRaw : "all";
  const activationRaw = searchParams.get("activation") ?? "all";
  const activation =
    activationRaw === "activated" || activationRaw === "not_activated"
      ? activationRaw
      : "all";
  const status = parseActivityStatus(searchParams.get("status"));

  try {
    const directory = await fetchCachedAdminUserDirectory(
      q,
      page,
      perPage,
      role,
      activation,
      status,
    );

    return NextResponse.json({
      success: true,
      me: auth.user.id,
      users: directory.users,
      pagination: directory.pagination,
      data: {
        me: auth.user.id,
        users: directory.users,
        pagination: directory.pagination,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        data: null,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const name =
    typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
  if (!userId && !name) {
    return NextResponse.json(
      { error: "userId or name required", success: false },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceRoleClient();
  const allUsers = await listAllAuthAdminUsers();
  let match = userId ? allUsers.find((u) => u.id === userId) : undefined;

  if (!match && name) {
    const matches = allUsers.filter((u) => {
      const displayName = getDisplayName({
        userId: u.id,
        email: u.email ?? null,
        userMetadata: u.user_metadata ?? null,
      }).toLowerCase();
      return displayName === name;
    });
    if (matches.length === 0) {
      return NextResponse.json(
        { error: "User not found by name", success: false },
        { status: 404 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        {
          error: `Multiple users matched this name (${matches.length}). Please use a unique name.`,
          success: false,
        },
        { status: 409 },
      );
    }
    match = matches[0];
  }

  if (!match) {
    return NextResponse.json(
      { error: "User not found by userId", success: false },
      { status: 404 },
    );
  }

  const { error: upsertError } = await service.from("user_roles").upsert({
    user_id: match.id,
    role: "admin",
  });
  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message, success: false },
      { status: 500 },
    );
  }

  await writeAdminAuditLog({
    adminUserId: auth.user.id,
    action: "admin_role_grant",
    resource: match.id,
    metadata: { email: match.email ?? null },
  });
  revalidateTag("admin-user-directory", { expire: 0 });
  revalidateTag("admin-analytics", { expire: 0 });
  invalidateAnalyticsAudienceCache();

  return NextResponse.json({
    success: true,
    ok: true,
    userId: match.id,
    name: getDisplayName({
      userId: match.id,
      email: match.email ?? null,
      userMetadata: match.user_metadata ?? null,
    }),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json(
      { error: "userId required", success: false },
      { status: 400 },
    );
  }
  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself from admin role", success: false },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) {
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 },
    );
  }

  await writeAdminAuditLog({
    adminUserId: auth.user.id,
    action: "admin_role_revoke",
    resource: userId,
  });
  revalidateTag("admin-user-directory", { expire: 0 });
  revalidateTag("admin-analytics", { expire: 0 });
  invalidateAnalyticsAudienceCache();

  return NextResponse.json({ success: true, ok: true });
}
