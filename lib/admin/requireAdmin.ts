import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";

export type AdminSession = {
  user: { id: string };
};

export async function requireAdmin(): Promise<
  AdminSession | { error: NextResponse }
> {
  let session: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    session = await getSessionUser();
  } catch (error) {
    console.error("[requireAdmin] Supabase session lookup failed:", error);
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", data: null },
        { status: 503 }
      ),
    };
  }
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED", data: null },
        { status: 401 }
      ),
    };
  }
  let canAccess: boolean;
  try {
    canAccess = await isAdminUser({
      supabase: session.supabase,
      userId: session.user.id,
      throwOnError: true,
    });
  } catch (error) {
    console.error("[requireAdmin] Supabase role lookup failed:", error);
    return {
      error: NextResponse.json(
        { success: false, error: "Authorization service unavailable", code: "AUTH_UNAVAILABLE", data: null },
        { status: 503 }
      ),
    };
  }
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
