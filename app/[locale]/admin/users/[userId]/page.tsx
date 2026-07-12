import { AdminUserDetailPanel } from "./AdminUserDetailPanel";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminUserDetailPanel userId={userId} />;
}
