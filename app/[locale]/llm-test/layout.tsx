import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";

export default async function LegacyModelConsoleLayout() {
  const session = await getSessionUser();
  if (!session) redirect("/auth");

  const canAccess = await isAdminUser({
    supabase: session.supabase,
    userId: session.user.id,
  });
  redirect(canAccess ? "/admin/models" : "/");
}
