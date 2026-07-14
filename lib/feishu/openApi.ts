/**
 * Minimal Feishu open platform helpers for Bot events (tenant token + reply).
 */

type TokenCache = { token: string; expiresAt: number };

let cached: TokenCache | null = null;

export function isFeishuBotConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.FEISHU_APP_ID?.trim() &&
      env.FEISHU_APP_SECRET?.trim() &&
      env.FEISHU_VERIFICATION_TOKEN?.trim()
  );
}

export async function getFeishuTenantAccessToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("FEISHU_APP_ID / FEISHU_APP_SECRET required");
  }
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const json = (await res.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
    expire?: number;
  };
  if (json.code !== 0 || !json.tenant_access_token) {
    throw new Error(`Feishu token error: ${json.msg ?? res.status}`);
  }
  cached = {
    token: json.tenant_access_token,
    expiresAt: Date.now() + (json.expire ?? 7200) * 1000,
  };
  return cached.token;
}

export async function replyFeishuTextMessage(params: {
  messageId: string;
  text: string;
}): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(params.messageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        content: JSON.stringify({ text: params.text }),
        msg_type: "text",
      }),
    }
  );
  const json = (await res.json()) as { code?: number; msg?: string };
  if (json.code !== 0) {
    throw new Error(`Feishu reply failed: ${json.msg ?? res.status}`);
  }
}

/** Upload a JPEG/PNG buffer; returns Feishu `image_key`. */
export async function uploadFeishuImage(buffer: Buffer, filename = "preview.jpg"): Promise<string> {
  const token = await getFeishuTenantAccessToken();
  const form = new FormData();
  form.append("image_type", "message");
  form.append(
    "image",
    new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
    filename
  );
  const res = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: { image_key?: string };
  };
  if (json.code !== 0 || !json.data?.image_key) {
    throw new Error(`Feishu image upload failed: ${json.msg ?? res.status}`);
  }
  return json.data.image_key;
}

export async function replyFeishuImageMessage(params: {
  messageId: string;
  imageKey: string;
}): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(params.messageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        content: JSON.stringify({ image_key: params.imageKey }),
        msg_type: "image",
      }),
    }
  );
  const json = (await res.json()) as { code?: number; msg?: string };
  if (json.code !== 0) {
    throw new Error(`Feishu image reply failed: ${json.msg ?? res.status}`);
  }
}

/** Extract plain text from Feishu im.message content JSON. */
export function extractFeishuMessageText(contentRaw: string): string | null {
  try {
    const content = JSON.parse(contentRaw) as { text?: string };
    return typeof content.text === "string" ? content.text : null;
  } catch {
    return null;
  }
}
