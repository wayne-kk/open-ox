import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { listProjectOwnerOptions } from "@/lib/projectOwnerOptions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET /api/projects/owners — admin-only (internal all-projects / moderation).
 * Member global gallery was removed; Community discovery is a separate surface.
 */
export async function GET() {
  try {
    const adminGate = await requireAdmin();
    if ("error" in adminGate) return adminGate.error;
    const admin = createSupabaseServiceRoleClient();
    const owners = await listProjectOwnerOptions(admin);
    return NextResponse.json(owners);
  } catch (err) {
    console.error("[GET /api/projects/owners]", err);
    return NextResponse.json(
      { error: "Failed to list project owners", code: "LIST_PROJECT_OWNERS_ERROR" },
      { status: 500 }
    );
  }
}
