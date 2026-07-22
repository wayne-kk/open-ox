import { NextRequest } from "next/server";
import { finalizeAuthenticatedLogin } from "@/lib/auth/post-login";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await finalizeAuthenticatedLogin({
    request,
    supabase: session.supabase,
    user: session.user,
    provider: "email",
  });

  return Response.json({ success: true });
}
