import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { AdminUsersPanel } from "./AdminUsersPanel";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/auth");
  }
  const canAccess = await isAdminUser({
    supabase: session.supabase,
    userId: session.user.id,
  });
  if (!canAccess) {
    redirect("/");
  }
  return <AdminUsersPanel />;
}
