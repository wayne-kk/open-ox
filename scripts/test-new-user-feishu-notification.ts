import { loadEnvConfig } from "@next/env";
import type { User } from "@supabase/supabase-js";
import {
  scheduleNewUserRegistrationNotification,
  type NewUserNotificationStore,
} from "@/lib/notifications/newUserRegistration";

loadEnvConfig(process.cwd());

const now = new Date();
const testUserId = "feishu-notification-test-user";
let delivery: Promise<void> | null = null;
let finalStatus: "claimed" | "sent" | "failed" = "claimed";

const store: NewUserNotificationStore = {
  async claim() {
    return {
      userId: testUserId,
      provider: "email",
      registeredAt: now.toISOString(),
    };
  },
  async markSent() {
    finalStatus = "sent";
  },
  async markFailed() {
    finalStatus = "failed";
  },
};

const user = {
  id: testUserId,
  aud: "authenticated",
  created_at: now.toISOString(),
  email: "new-user-test@example.com",
  app_metadata: { provider: "email" },
  user_metadata: { provider: "email", full_name: "通知配置测试" },
} as User;

const result = await scheduleNewUserRegistrationNotification(user, {
  store,
  defer(task) {
    delivery = task();
  },
  fetch: globalThis.fetch,
  config: {
    webhookUrl: process.env.FEISHU_NEW_USER_WEBHOOK_URL?.trim(),
    webhookSecret: process.env.FEISHU_NEW_USER_WEBHOOK_SECRET?.trim(),
    cardTitle: "新用户注册（测试）",
  },
  now: () => new Date(),
  logger: console,
  timeoutSignal: (milliseconds) => AbortSignal.timeout(milliseconds),
});

if (result.status !== "scheduled" || !delivery) {
  throw new Error(
    `Test notification was not scheduled (status: ${result.status})`,
  );
}

await delivery;

if (finalStatus !== "sent") {
  throw new Error(
    "Feishu rejected the test notification; check the redacted error above",
  );
}

console.log("Feishu new-user test card sent successfully.");
