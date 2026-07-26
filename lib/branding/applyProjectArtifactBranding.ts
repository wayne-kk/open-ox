import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { applyPublicArtifactBranding } from "./publicArtifactBranding";
import {
  getProjectBrandingAttributionToken,
  hasProjectBrandRemoval,
} from "./projectBrandEntitlement";

function publicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://open-ox.tech"
  );
}

export async function applyProjectArtifactBranding(
  outDir: string,
  projectId: string,
  db: SupabaseClient = createSupabaseServiceRoleClient(),
  publicChannel: "publish_preview" | "vercel_deploy" = "publish_preview",
): Promise<void> {
  const [removeBranding, projectToken] = await Promise.all([
    hasProjectBrandRemoval(db, projectId),
    getProjectBrandingAttributionToken(db, projectId),
  ]);
  await applyPublicArtifactBranding(outDir, {
    removeBranding,
    projectToken,
    appUrl: publicAppUrl(),
    publicChannel,
  });
}
