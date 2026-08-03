import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { AdminShell } from "./components/AdminShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Open-OX",
  robots: { index: false, follow: false },
};

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
