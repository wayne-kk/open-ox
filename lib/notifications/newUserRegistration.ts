import { createHmac } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type NewUserNotificationProvider = "google" | "email" | "linuxdo";

export type NewUserNotificationCandidate = {
  userId: string;
  provider: NewUserNotificationProvider;
  registeredAt: string;
};

export type NewUserNotificationStore = {
  claim(
    userId: string,
    claimedAt: string,
  ): Promise<NewUserNotificationCandidate | null>;
  markSent(userId: string, sentAt: string): Promise<void>;
  markFailed(userId: string, failedAt: string): Promise<void>;
};

type DeferredTask = () => Promise<void>;

export type NewUserNotificationRuntime = {
  store: NewUserNotificationStore;
  defer(task: DeferredTask): void;
  fetch: typeof globalThis.fetch;
  config: {
    webhookUrl?: string;
    webhookSecret?: string;
    cardTitle?: string;
  };
  now(): Date;
  logger: Pick<Console, "warn" | "error">;
  timeoutSignal?(milliseconds: number): AbortSignal;
};

type ScheduleResult =
  | { status: "scheduled" }
  | { status: "skipped" }
  | { status: "failed" };

function providerHint(user: User): NewUserNotificationProvider | "unknown" {
  const metadata = user.user_metadata as Record<string, unknown>;
  if (metadata.provider === "linuxdo") return "linuxdo";
  const provider = user.app_metadata?.provider;
  if (provider === "google" || provider === "email") return provider;
  return metadata.provider === "email" ? "email" : "unknown";
}

export function createFeishuWebhookSignature(
  timestamp: string,
  secret: string,
): string {
  return createHmac("sha256", `${timestamp}\n${secret}`)
    .update("")
    .digest("base64");
}

function shanghaiDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part(
    "minute",
  )}:${part("second")}`;
}

function displayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown>;
  const value = [
    metadata.full_name,
    metadata.name,
    metadata.preferred_username,
  ].find((candidate) => typeof candidate === "string" && candidate.trim());
  if (typeof value === "string") return value.trim();
  return user.email?.split("@")[0] || "用户";
}

function safeCardValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\*_~`[\]()])/g, "\\$1");
}

function createSupabaseNotificationStore(
  client: SupabaseClient,
): NewUserNotificationStore {
  return {
    async claim(userId, claimedAt) {
      const { data, error } = await client
        .from("new_user_notifications")
        .update({ status: "claimed", claimed_at: claimedAt })
        .eq("user_id", userId)
        .eq("status", "pending")
        .select("user_id,provider,registered_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        userId: String(data.user_id),
        provider: data.provider as NewUserNotificationProvider,
        registeredAt: String(data.registered_at),
      };
    },
    async markSent(userId, sentAt) {
      const { error } = await client
        .from("new_user_notifications")
        .update({ status: "sent", sent_at: sentAt })
        .eq("user_id", userId)
        .eq("status", "claimed");
      if (error) throw error;
    },
    async markFailed(userId, failedAt) {
      const { error } = await client
        .from("new_user_notifications")
        .update({ status: "failed", failed_at: failedAt })
        .eq("user_id", userId)
        .eq("status", "claimed");
      if (error) throw error;
    },
  };
}

function productionRuntime(
  config: NewUserNotificationRuntime["config"],
): NewUserNotificationRuntime {
  return {
    store: createSupabaseNotificationStore(createSupabaseServiceRoleClient()),
    defer: (task) => after(task),
    fetch: globalThis.fetch,
    config,
    now: () => new Date(),
    logger: console,
    timeoutSignal: (milliseconds) => AbortSignal.timeout(milliseconds),
  };
}

function buildCard(
  user: User,
  candidate: NewUserNotificationCandidate,
  title = "新用户注册",
) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const isLinuxDo = candidate.provider === "linuxdo";
  const identity = isLinuxDo
    ? typeof metadata.linuxdo_username === "string" &&
      metadata.linuxdo_username.trim()
      ? metadata.linuxdo_username.trim()
      : displayName(user)
    : displayName(user);
  const accountLabel = isLinuxDo ? "Linux.do ID" : "邮箱";
  const accountValue = isLinuxDo
    ? typeof metadata.linuxdo_id === "string" && metadata.linuxdo_id.trim()
      ? metadata.linuxdo_id.trim()
      : "-"
    : (user.email ?? "-");
  const providerLabel =
    candidate.provider === "linuxdo"
      ? "Linux.do"
      : candidate.provider === "email"
        ? "邮箱"
        : "Google";
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "green",
      title: { tag: "plain_text", content: title },
    },
    elements: [
      {
        tag: "div",
        fields: [
          {
            is_short: true,
            text: { tag: "lark_md", content: `**渠道**\n${providerLabel}` },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**注册时间**\n${shanghaiDateTime(candidate.registeredAt)}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**用户**\n${safeCardValue(identity)}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**${accountLabel}**\n${safeCardValue(accountValue)}`,
            },
          },
        ],
      },
    ],
  };
}

export async function scheduleNewUserRegistrationNotification(
  user: User,
  runtime?: NewUserNotificationRuntime,
): Promise<ScheduleResult> {
  let activeRuntime: NewUserNotificationRuntime;
  const productionConfig = runtime
    ? null
    : {
        webhookUrl: process.env.FEISHU_NEW_USER_WEBHOOK_URL?.trim(),
        webhookSecret: process.env.FEISHU_NEW_USER_WEBHOOK_SECRET?.trim(),
      };

  const config = runtime?.config ?? productionConfig;
  if (!config?.webhookUrl || !config.webhookSecret) {
    (runtime?.logger ?? console).warn("[new-user-notification] disabled", {
      userId: user.id,
      provider: providerHint(user),
      category: "configuration",
    });
    return { status: "skipped" };
  }

  try {
    activeRuntime = runtime ?? productionRuntime(config);
  } catch {
    console.error("[new-user-notification] setup failed", {
      userId: user.id,
      provider: providerHint(user),
      category: "configuration",
    });
    return { status: "failed" };
  }

  const claimedAt = activeRuntime.now().toISOString();
  let candidate: NewUserNotificationCandidate | null;
  try {
    candidate = await activeRuntime.store.claim(user.id, claimedAt);
  } catch {
    activeRuntime.logger.error("[new-user-notification] claim failed", {
      userId: user.id,
      provider: providerHint(user),
      category: "database",
    });
    return { status: "failed" };
  }
  if (!candidate) return { status: "skipped" };

  try {
    activeRuntime.defer(async () => {
      const failDelivery = async (
        category:
          | "configuration"
          | "timeout"
          | "transport"
          | "http"
          | "feishu"
          | "response",
        code?: number,
      ) => {
        try {
          await activeRuntime.store.markFailed(
            user.id,
            activeRuntime.now().toISOString(),
          );
        } catch {
          activeRuntime.logger.error(
            "[new-user-notification] status update failed",
            {
              userId: user.id,
              provider: candidate.provider,
              category: "database",
              targetStatus: "failed",
            },
          );
        }
        activeRuntime.logger.error("[new-user-notification] delivery failed", {
          userId: user.id,
          provider: candidate.provider,
          category,
          ...(code == null ? {} : { code }),
        });
      };

      const { webhookUrl, webhookSecret } = activeRuntime.config;
      if (!webhookUrl || !webhookSecret) {
        await failDelivery("configuration");
        return;
      }
      const timestamp = String(
        Math.floor(activeRuntime.now().getTime() / 1000),
      );
      let response: Response;
      try {
        response = await activeRuntime.fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp,
            sign: createFeishuWebhookSignature(timestamp, webhookSecret),
            msg_type: "interactive",
            card: buildCard(user, candidate, activeRuntime.config.cardTitle),
          }),
          signal:
            activeRuntime.timeoutSignal?.(5_000) ?? AbortSignal.timeout(5_000),
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        await failDelivery(
          name === "TimeoutError" || name === "AbortError"
            ? "timeout"
            : "transport",
        );
        return;
      }

      if (!response.ok) {
        await failDelivery("http", response.status);
        return;
      }

      let body: { code?: number; StatusCode?: number };
      try {
        body = (await response.json()) as {
          code?: number;
          StatusCode?: number;
        };
      } catch {
        await failDelivery("response");
        return;
      }
      const feishuCode = body.code ?? body.StatusCode;
      if (feishuCode !== 0) {
        await failDelivery("feishu", feishuCode);
        return;
      }

      try {
        await activeRuntime.store.markSent(
          user.id,
          activeRuntime.now().toISOString(),
        );
      } catch {
        activeRuntime.logger.error(
          "[new-user-notification] status update failed",
          {
            userId: user.id,
            provider: candidate.provider,
            category: "database",
            targetStatus: "sent",
          },
        );
      }
    });
  } catch {
    activeRuntime.logger.error("[new-user-notification] scheduling failed", {
      userId: user.id,
      provider: candidate.provider,
      category: "runtime",
    });
    return { status: "failed" };
  }

  return { status: "scheduled" };
}
