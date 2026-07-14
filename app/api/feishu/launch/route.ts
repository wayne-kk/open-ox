import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildFeishuBotOpenUrl,
  linkFeishuOpenId,
  setFeishuActiveProject,
} from "@/lib/feishu/activeProject";

export const runtime = "nodejs";

/**
 * POST /api/feishu/launch
 * Body: { projectId: string }
 *
 * One-shot: bind Feishu open_id from session → set active project → return bot applink.
 */
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let projectId: string;
  try {
    const body = await req.json();
    if (typeof body.projectId !== "string" || !body.projectId.trim()) {
      return NextResponse.json(
        { error: "projectId required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }
    projectId = body.projectId.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const openId = typeof meta?.feishu_open_id === "string" ? meta.feishu_open_id.trim() : "";
  if (!openId) {
    const next = `/studio/${encodeURIComponent(projectId)}?feishu_launch=1`;
    return NextResponse.json({
      needFeishuLogin: true,
      loginUrl: `/api/auth/feishu/start?next=${encodeURIComponent(next)}`,
      message: "请先用飞书登录，回来后会自动打开机器人",
    });
  }

  const botUrl = buildFeishuBotOpenUrl();
  if (!botUrl) {
    return NextResponse.json(
      { error: "FEISHU_APP_ID not configured", code: "CONFIG" },
      { status: 503 }
    );
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Service role unavailable", code: "CONFIG" },
      { status: 503 }
    );
  }

  await linkFeishuOpenId(admin, session.user.id, openId);
  const setResult = await setFeishuActiveProject(admin, session.user.id, projectId);
  if (!setResult.ok) {
    const status = setResult.code === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json(
      { error: setResult.message, code: setResult.code },
      { status }
    );
  }

  return NextResponse.json({
    needFeishuLogin: false,
    botUrl,
    projectId: setResult.projectId,
    projectName: setResult.projectName,
  });
}
