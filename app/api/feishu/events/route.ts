import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveUserIdByFeishuOpenId } from "@/lib/feishu/activeProject";
import { handleFeishuBotText } from "@/lib/feishu/handleBotCommand";
import {
  extractFeishuMessageText,
  isFeishuBotConfigured,
  replyFeishuTextMessage,
} from "@/lib/feishu/openApi";
import { getBotFacingOrigin } from "@/lib/auth/request-origin";


export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "feishu-events",
    botConfigured: isFeishuBotConfigured(),
    hint: "POST url_verification / im.message.receive_v1 here",
  });
}

/**
 * Feishu event subscription endpoint.
 * Configure Request URL to `{origin}/api/feishu/events` and set FEISHU_VERIFICATION_TOKEN.
 *
 * Issue 03–04: identity + commands + text Modify loop (screenshot in issue 05).
 */
export async function POST(req: Request) {
  // Always log — if this never appears when you DM the bot, Feishu is not hitting this URL.
  console.log("[feishu/events] POST hit", {
    at: new Date().toISOString(),
    contentType: req.headers.get("content-type"),
    userAgent: req.headers.get("user-agent"),
  });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    console.log("[feishu/events] invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[feishu/events] body keys", Object.keys(body), {
    type: body.type,
    hasEncrypt: typeof body.encrypt === "string",
    schema: body.schema,
  });

  // Encrypted payloads need Encrypt Key handling — not supported in MVP.
  if (typeof body.encrypt === "string" && body.type !== "url_verification") {
    console.error(
      "[feishu/events] encrypted event received — clear Encrypt Key in Feishu console (加密策略)"
    );
    return NextResponse.json({ code: 0 });
  }

  // URL verification MUST run even if other bot secrets are incomplete —
  // Feishu only accepts a 200 body shaped as { challenge }.
  if (body.type === "url_verification" && typeof body.challenge === "string") {
    const expected = process.env.FEISHU_VERIFICATION_TOKEN?.trim() ?? "";
    if (!expected) {
      console.error(
        "[feishu/events] url_verification failed: FEISHU_VERIFICATION_TOKEN is not set in the server env"
      );
      return NextResponse.json(
        {
          error:
            "FEISHU_VERIFICATION_TOKEN missing — copy Verification Token from Feishu console into .env.local and restart",
        },
        { status: 503 }
      );
    }
    const token = typeof body.token === "string" ? body.token : "";
    if (token !== expected) {
      console.error("[feishu/events] url_verification failed: token mismatch");
      return NextResponse.json({ error: "bad token" }, { status: 403 });
    }
    console.info("[feishu/events] url_verification ok");
    return NextResponse.json({ challenge: body.challenge });
  }

  const header = body.header as { token?: string; event_type?: string } | undefined;
  console.info("[feishu/events] inbound", {
    type: body.type,
    event_type: header?.event_type,
    schema: typeof body.schema === "string" ? body.schema : undefined,
  });

  if (!isFeishuBotConfigured()) {
    console.error("[feishu/events] bot not configured");
    return NextResponse.json(
      { error: "Feishu bot not configured (need FEISHU_APP_ID/SECRET + FEISHU_VERIFICATION_TOKEN)" },
      { status: 503 }
    );
  }

  if (header?.token && header.token !== process.env.FEISHU_VERIFICATION_TOKEN?.trim()) {
    return NextResponse.json({ error: "bad token" }, { status: 403 });
  }

  // v2 schema: event under body.event
  const event = (body.event ?? body) as Record<string, unknown>;
  const eventType =
    header?.event_type ??
    (typeof body.type === "string" ? body.type : undefined) ??
    (typeof event.type === "string" ? event.type : undefined);

  // Only handle p2p DMs for now
  if (eventType === "im.message.receive_v1" || eventType === "im.message.receive_v1.0") {
    // Respond 200 quickly; process async
    void handleImMessage(event, req).catch((err) => {
      console.error("[feishu/events] handler error:", err);
    });
    return NextResponse.json({ code: 0 });
  }

  // Older schema may nest differently — ignore quietly
  return NextResponse.json({ code: 0 });
}

async function handleImMessage(event: Record<string, unknown>, req: Request): Promise<void> {
  const message = event.message as
    | {
        message_id?: string;
        chat_type?: string;
        message_type?: string;
        content?: string;
      }
    | undefined;
  const sender = event.sender as
    | { sender_id?: { open_id?: string }; sender_type?: string }
    | undefined;

  if (!message?.message_id) return;

  // Group chats: politely decline (DM-only MVP)
  if (message.chat_type && message.chat_type !== "p2p") {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: "Open-OX 改站 Bot 目前仅支持私聊。",
    });
    return;
  }

  if (message.message_type === "image" || message.message_type === "post") {
    const origin = getBotFacingOrigin(req);
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: `暂不支持图片，请打开 Studio 附图修改：${origin}/dashboard`,
    });
    return;
  }

  if (message.message_type && message.message_type !== "text") {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: "目前只支持文本消息。输入 /help 查看命令。",
    });
    return;
  }

  const text = extractFeishuMessageText(message.content ?? "");
  if (text == null) {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: "未能解析消息内容。输入 /help 查看命令。",
    });
    return;
  }

  const openId = sender?.sender_id?.open_id;
  if (!openId) {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: "无法识别飞书用户。",
    });
    return;
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: "服务暂时不可用（缺少 service role）。",
    });
    return;
  }

  const userId = await resolveUserIdByFeishuOpenId(admin, openId);
  if (!userId) {
    const origin = getBotFacingOrigin(req);
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: `还没绑定 Open-OX 账号。\n请打开网站 Studio，点顶栏「飞书改」（需曾用飞书登录过）。\n${origin}/auth`,
    });
    return;
  }

  const reply = await handleFeishuBotText({
    db: admin,
    userId,
    text,
    modifyEnabled: true,
  });

  if (reply.skipModify) {
    await replyFeishuTextMessage({
      messageId: message.message_id,
      text: reply.text,
    });
    return;
  }

  const { runFeishuModifyFromDm } = await import("@/lib/feishu/runFeishuModify");
  await runFeishuModifyFromDm({
    db: admin,
    userId,
    instruction: reply.text,
    messageId: message.message_id,
    studioOrigin: getBotFacingOrigin(req),
  });
}
