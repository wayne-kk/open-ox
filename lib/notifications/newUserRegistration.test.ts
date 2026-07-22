import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFeishuWebhookSignature,
  scheduleNewUserRegistrationNotification,
  type NewUserNotificationCandidate,
  type NewUserNotificationRuntime,
  type NewUserNotificationStore,
} from "./newUserRegistration";

const DEFAULT_NOW = "2026-07-22T03:01:00.000Z";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-google-1",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Ada Lovelace" },
    aud: "authenticated",
    created_at: "2026-07-22T02:03:04.000Z",
    email: "ada@example.com",
    ...overrides,
  } as User;
}

function makeCandidate(
  overrides: Partial<NewUserNotificationCandidate> = {},
): NewUserNotificationCandidate {
  return {
    userId: "user-google-1",
    provider: "google",
    registeredAt: "2026-07-22T02:03:04.000Z",
    ...overrides,
  };
}

type HarnessOptions = {
  candidate?: NewUserNotificationCandidate | null;
  store?: Partial<NewUserNotificationStore>;
  fetchMock?: ReturnType<typeof vi.fn>;
  config?: NewUserNotificationRuntime["config"];
  now?: string;
  defer?: NewUserNotificationRuntime["defer"];
  timeoutSignal?: NewUserNotificationRuntime["timeoutSignal"];
};

function makeHarness(options: HarnessOptions = {}) {
  const candidate = Object.hasOwn(options, "candidate")
    ? (options.candidate ?? null)
    : makeCandidate();
  const store: NewUserNotificationStore = {
    claim: vi.fn().mockResolvedValue(candidate),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...options.store,
  };
  const fetchMock =
    options.fetchMock ??
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, msg: "success" }),
    });
  const deferred: Array<() => Promise<void>> = [];
  const logger = { warn: vi.fn(), error: vi.fn() };
  const runtime: NewUserNotificationRuntime = {
    store,
    defer: options.defer ?? ((task) => deferred.push(task)),
    fetch: fetchMock as unknown as typeof fetch,
    config: options.config ?? {
      webhookUrl: "https://example.test/hook",
      webhookSecret: "secret",
    },
    now: () => new Date(options.now ?? DEFAULT_NOW),
    logger,
    timeoutSignal: options.timeoutSignal,
  };
  return { deferred, fetchMock, logger, runtime, store };
}

async function runDeferred(harness: ReturnType<typeof makeHarness>) {
  expect(harness.deferred).toHaveLength(1);
  await harness.deferred[0]?.();
}

function requestBody(harness: ReturnType<typeof makeHarness>) {
  const [, init] = harness.fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("new-user registration notification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("generates the Feishu custom-bot signature", () => {
    expect(createFeishuWebhookSignature("1599360473", "example-secret")).toBe(
      "Gqzo3d51m9P8CAgrn86JBZIipyhJhGOpHQbUT4HViD0=",
    );
  });

  it("claims a Google registration and sends one card after the auth response", async () => {
    const harness = makeHarness({
      now: "2026-07-22T02:04:05.000Z",
      config: {
        webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test",
        webhookSecret: "signing-secret",
      },
    });

    const result = await scheduleNewUserRegistrationNotification(
      makeUser(),
      harness.runtime,
    );

    expect(result).toEqual({ status: "scheduled" });
    expect(harness.store.claim).toHaveBeenCalledWith(
      "user-google-1",
      "2026-07-22T02:04:05.000Z",
    );
    expect(harness.fetchMock).not.toHaveBeenCalled();

    await runDeferred(harness);

    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = harness.fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://open.feishu.cn/open-apis/bot/v2/hook/test");
    expect(init.method).toBe("POST");
    const body = requestBody(harness);
    const cardText = JSON.stringify(body.card);
    expect(body.msg_type).toBe("interactive");
    expect(body.timestamp).toBe("1784685845");
    expect(body.sign).toEqual(expect.any(String));
    expect(cardText).toContain("新用户注册");
    expect(cardText).toContain("Google");
    expect(cardText).toContain("Ada Lovelace");
    expect(cardText).toContain("ada@example.com");
    expect(cardText).toContain("2026-07-22 10:03:04");
    expect(harness.store.markSent).toHaveBeenCalledWith(
      "user-google-1",
      "2026-07-22T02:04:05.000Z",
    );
    expect(harness.store.markFailed).not.toHaveBeenCalled();
  });

  it("sends an unsigned card when the bot has no signing secret", async () => {
    const harness = makeHarness({
      config: { webhookUrl: "https://example.test/hook" },
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    const body = requestBody(harness);
    expect(body.timestamp).toBeUndefined();
    expect(body.sign).toBeUndefined();
    expect(body.msg_type).toBe("interactive");
    expect(harness.store.markSent).toHaveBeenCalledTimes(1);
  });

  it("allows the command-line sender to label a card as a test", async () => {
    const harness = makeHarness({
      candidate: makeCandidate({ provider: "email" }),
      config: {
        webhookUrl: "https://example.test/hook",
        webhookSecret: "secret",
        cardTitle: "新用户注册（测试）",
      },
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    const cardText = JSON.stringify(requestBody(harness).card);
    expect(cardText).toContain("新用户注册（测试）");
    expect(cardText).toContain("邮箱");
    expect(cardText).toContain("ada@example.com");
  });

  it("accepts the legacy Feishu custom-bot success response", async () => {
    const harness = makeHarness({
      fetchMock: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ StatusCode: 0, StatusMessage: "success" }),
      }),
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    expect(harness.store.markSent).toHaveBeenCalledTimes(1);
    expect(harness.store.markFailed).not.toHaveBeenCalled();
  });

  it("renders Linux.do identity without exposing its synthetic email", async () => {
    const harness = makeHarness({
      candidate: makeCandidate({
        userId: "user-linuxdo-42",
        provider: "linuxdo",
        registeredAt: "2026-07-22T03:00:00.000Z",
      }),
    });
    const user = makeUser({
      id: "user-linuxdo-42",
      email: "42@linuxdo.open-ox.local",
      app_metadata: { provider: "email" },
      user_metadata: {
        provider: "linuxdo",
        linuxdo_id: "42",
        linuxdo_username: "magic-user",
        full_name: "Magic User",
      },
    });

    await scheduleNewUserRegistrationNotification(user, harness.runtime);
    await runDeferred(harness);

    const cardText = JSON.stringify(requestBody(harness).card);
    expect(cardText).toContain("Linux.do");
    expect(cardText).toContain("magic-user");
    expect(cardText).toContain("42");
    expect(cardText).not.toContain("linuxdo.open-ox.local");
  });

  it("escapes user-controlled card values before rendering Feishu markdown", async () => {
    const harness = makeHarness();
    const user = makeUser({
      user_metadata: {
        full_name: "<at id=all>Everyone</at>\n**渠道** Linux.do",
      },
    });

    await scheduleNewUserRegistrationNotification(user, harness.runtime);
    await runDeferred(harness);

    const cardText = JSON.stringify(requestBody(harness).card);
    expect(cardText).not.toContain("<at");
    expect(cardText).not.toContain("**渠道** Linux.do");
    expect(cardText).toContain("Everyone");
  });

  it("does not schedule delivery when the user has no pending registration", async () => {
    const harness = makeHarness({ candidate: null });

    const result = await scheduleNewUserRegistrationNotification(
      makeUser(),
      harness.runtime,
    );

    expect(result).toEqual({ status: "skipped" });
    expect(harness.deferred).toHaveLength(0);
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("isolates claim failures from auth success and logs no profile data", async () => {
    const harness = makeHarness({
      store: {
        claim: vi
          .fn()
          .mockRejectedValue(
            new Error("database unavailable for ada@example.com"),
          ),
      },
    });

    const result = await scheduleNewUserRegistrationNotification(
      makeUser(),
      harness.runtime,
    );

    expect(result).toEqual({ status: "failed" });
    expect(harness.deferred).toHaveLength(0);
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] claim failed",
      { userId: "user-google-1", provider: "google", category: "database" },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "database unavailable",
    );
  });

  it("isolates missing production database configuration from auth success", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("FEISHU_NEW_USER_WEBHOOK_URL", "https://example.test/hook");
    vi.stubEnv("FEISHU_NEW_USER_WEBHOOK_SECRET", "secret");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      scheduleNewUserRegistrationNotification(makeUser()),
    ).resolves.toEqual({
      status: "failed",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[new-user-notification] setup failed",
      {
        userId: "user-google-1",
        provider: "google",
        category: "configuration",
      },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("marks a Feishu rejection failed and logs only its error code", async () => {
    const harness = makeHarness({
      fetchMock: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 19001,
          msg: "rejected ada@example.com signing-secret",
        }),
      }),
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    expect(harness.store.markFailed).toHaveBeenCalledWith(
      "user-google-1",
      DEFAULT_NOW,
    );
    expect(harness.store.markSent).not.toHaveBeenCalled();
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] delivery failed",
      {
        userId: "user-google-1",
        provider: "google",
        category: "feishu",
        code: 19001,
      },
    );
    const logs = JSON.stringify(harness.logger.error.mock.calls);
    expect(logs).not.toContain("ada@example.com");
    expect(logs).not.toContain("signing-secret");
  });

  it.each([
    {
      name: "HTTP failure",
      fetchResult: { ok: false, status: 503, json: async () => ({}) },
      expected: { category: "http", code: 503 },
    },
    {
      name: "invalid JSON response",
      fetchResult: {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("invalid response containing ada@example.com");
        },
      },
      expected: { category: "response" },
    },
  ])("marks $name failed", async ({ fetchResult, expected }) => {
    const harness = makeHarness({
      fetchMock: vi.fn().mockResolvedValue(fetchResult),
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    expect(harness.store.markFailed).toHaveBeenCalledTimes(1);
    expect(harness.store.markSent).not.toHaveBeenCalled();
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] delivery failed",
      { userId: "user-google-1", provider: "google", ...expected },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("marks an ordinary network failure without exposing its message", async () => {
    const harness = makeHarness({
      fetchMock: vi
        .fn()
        .mockRejectedValue(new Error("fetch failed for ada@example.com")),
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await runDeferred(harness);

    expect(harness.store.markFailed).toHaveBeenCalledTimes(1);
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] delivery failed",
      { userId: "user-google-1", provider: "google", category: "transport" },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("skips before claiming when the webhook URL is missing", async () => {
    const harness = makeHarness({
      config: {},
    });

    const result = await scheduleNewUserRegistrationNotification(
      makeUser(),
      harness.runtime,
    );

    expect(result).toEqual({ status: "skipped" });
    expect(harness.fetchMock).not.toHaveBeenCalled();
    expect(harness.store.claim).not.toHaveBeenCalled();
    expect(harness.store.markFailed).not.toHaveBeenCalled();
    expect(harness.deferred).toHaveLength(0);
    expect(harness.logger.warn).toHaveBeenCalledWith(
      "[new-user-notification] disabled",
      {
        userId: "user-google-1",
        provider: "google",
        category: "configuration",
      },
    );
  });

  it("marks a timed-out webhook failed without rejecting the deferred task", async () => {
    const timeoutSignal = vi.fn().mockReturnValue(new AbortController().signal);
    const harness = makeHarness({
      fetchMock: vi
        .fn()
        .mockRejectedValue(
          new DOMException("request leaked ada@example.com", "TimeoutError"),
        ),
      timeoutSignal,
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await expect(runDeferred(harness)).resolves.toBeUndefined();

    expect(timeoutSignal).toHaveBeenCalledWith(5_000);
    expect(harness.fetchMock.mock.calls[0]?.[1]?.signal).toBe(
      timeoutSignal.mock.results[0]?.value,
    );
    expect(harness.store.markFailed).toHaveBeenCalledTimes(1);
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] delivery failed",
      { userId: "user-google-1", provider: "google", category: "timeout" },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("isolates failure to register the post-response task from auth success", async () => {
    const harness = makeHarness({
      defer: () => {
        throw new Error("after unavailable ada@example.com");
      },
    });

    const result = await scheduleNewUserRegistrationNotification(
      makeUser(),
      harness.runtime,
    );

    expect(result).toEqual({ status: "failed" });
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] scheduling failed",
      { userId: "user-google-1", provider: "google", category: "runtime" },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("isolates failure to persist the sent status", async () => {
    const harness = makeHarness({
      store: {
        markSent: vi
          .fn()
          .mockRejectedValue(new Error("database leaked ada@example.com")),
      },
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await expect(runDeferred(harness)).resolves.toBeUndefined();

    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] status update failed",
      {
        userId: "user-google-1",
        provider: "google",
        category: "database",
        targetStatus: "sent",
      },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });

  it("isolates failure to persist the failed status", async () => {
    const harness = makeHarness({
      store: {
        markFailed: vi
          .fn()
          .mockRejectedValue(new Error("database leaked ada@example.com")),
      },
      fetchMock: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: 19001 }),
      }),
    });

    await scheduleNewUserRegistrationNotification(makeUser(), harness.runtime);
    await expect(runDeferred(harness)).resolves.toBeUndefined();

    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] status update failed",
      {
        userId: "user-google-1",
        provider: "google",
        category: "database",
        targetStatus: "failed",
      },
    );
    expect(harness.logger.error).toHaveBeenCalledWith(
      "[new-user-notification] delivery failed",
      {
        userId: "user-google-1",
        provider: "google",
        category: "feishu",
        code: 19001,
      },
    );
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain(
      "ada@example.com",
    );
  });
});
