"use client";

import {
  acquisitionTouchToProperties,
  captureClientAcquisition,
  readOxAcqCookie,
} from "@/lib/analytics/acquisition";
import { AnalyticsEventName } from "@/lib/analytics/catalog";

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

function acquisitionPropsForEvents(): Record<string, unknown> {
  const touch = readOxAcqCookie();
  if (!touch) return {};
  return acquisitionTouchToProperties(touch) as Record<string, unknown>;
}

export function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  queue.push({
    eventName,
    properties: {
      ...acquisitionPropsForEvents(),
      ...properties,
    },
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

/**
 * First-touch capture on landing. Writes ox_acq once and emits acquisition_captured.
 */
export function ensureAcquisitionCaptured(): void {
  if (typeof window === "undefined") return;
  const touch = captureClientAcquisition({ anonymousId: getAnonymousId() });
  if (!touch) return;
  trackEvent(
    AnalyticsEventName.acquisitionCaptured,
    acquisitionTouchToProperties(touch) as Record<string, unknown>
  );
}

export function trackPageView(path: string): void {
  trackEvent(AnalyticsEventName.pageView, { path });
}

export function startStudioHeartbeat(path: string): () => void {
  trackEvent(AnalyticsEventName.studioEnter, { path });
  const timer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    trackEvent(AnalyticsEventName.studioHeartbeat, { path });
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
