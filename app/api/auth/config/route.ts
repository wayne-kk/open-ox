import { NextResponse } from "next/server";
import { isFeishuOAuthConfigured } from "@/lib/auth/feishu-env";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-env";
import { isVercelDeployConfigured } from "@/lib/vercel/env";

/**
 * Public hints for the login UI (no secrets). Used to avoid linking to a broken OAuth flow.
 */
export async function GET() {
  return NextResponse.json({
    feishuLoginEnabled: isFeishuOAuthConfigured(),
    googleLoginEnabled: isGoogleOAuthConfigured(),
    vercelDeployEnabled: isVercelDeployConfigured(),
  });
}
