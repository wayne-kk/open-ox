import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function writeAdminAuditLog(params: {
  adminUserId: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("admin_audit_logs").insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    resource: params.resource,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.warn("[admin_audit_logs] insert failed:", error.message);
  }
}
