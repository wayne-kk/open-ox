"use client";

const ANON_KEY = "ox_anonymous_id";
const SESSION_KEY = "ox_session_id";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE = 20;

type PendingEvent = {
  eventName: string;
  properties?: Record<string, unknown>;
  clientTs: string;
  sessionId: string;
  anonymousId: string;
};

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getAnonymousId(): string {
  if (typeof window === "undefined") return "anon_ssr";
  const existing = window.localStorage.getItem(ANON_KEY);
  if (existing) return existing;
  const next = randomId("anon");
  window.localStorage.setItem(ANON_KEY, next);
  return next;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "session_ssr";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomId("sess");
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

let queue: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushQueue() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_QUEUE);
  try {
    await fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    queue.unshift(...batch);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

export function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  queue.push({
    eventName,
    properties,
    clientTs: new Date().toISOString(),
    sessionId: getSessionId(),
    anonymousId: getAnonymousId(),
  });
  if (queue.length >= MAX_QUEUE) {
    void flushQueue();
    return;
  }
  scheduleFlush();
}

export function trackPageView(path: string): void {
  trackEvent("page_view", { path });
}

export function startStudioHeartbeat(path: string): () => void {
  trackEvent("studio_enter", { path });
  const timer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    trackEvent("studio_heartbeat", { path });
  }, 30_000);
  return () => clearInterval(timer);
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushQueue();
    }
  });
  window.addEventListener("pagehide", () => {
    void flushQueue();
  });
}
