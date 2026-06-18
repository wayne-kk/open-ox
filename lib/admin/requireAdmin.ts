import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";

export type AdminSession = {
  user: { id: string };
};

export async function requireAdmin(): Promise<
  AdminSession | { error: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED", data: null },
        { status: 401 }
      ),
    };
  }
  const canAccess = await isAdminUser({
    supabase: session.supabase,
    userId: session.user.id,
  });
  if (!canAccess) {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden", code: "FORBIDDEN", data: null },
        { status: 403 }
      ),
    };
  }
  return { user: session.user };
}
