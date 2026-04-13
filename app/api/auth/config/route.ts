import { NextResponse } from "next/server";
import { isFeishuOAuthConfigured } from "@/lib/auth/feishu-env";

/**
 * Public hints for the login UI (no secrets). Used to avoid linking to a broken Feishu OAuth flow.
 */
export async function GET() {
  return NextResponse.json({ feishuLoginEnabled: isFeishuOAuthConfigured() });
}
