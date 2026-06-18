import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { AdminShell } from "./components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return <AdminShell>{children}</AdminShell>;
}
