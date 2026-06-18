import type { AnalyticsEventRecord } from "@/lib/admin/analytics/dataLoader";
import { formatDateKey, startOfUtcDay } from "@/lib/admin/analytics/dateRange";

const SESSION_GAP_MS = 30 * 60_000;
const HEARTBEAT_MS = 30_000;

export type SessionMetrics = {
  sessionId: string;
  userId: string | null;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  startDateKey: string;
};

export function normalizePagePath(path: unknown): string {
  if (typeof path !== "string" || !path.trim()) return "unknown";
  const clean = path.split("?")[0] ?? path;
  if (clean === "/") return "/";
  if (clean.startsWith("/studio")) return "/studio";
  if (clean.startsWith("/auth")) return "/auth";
  if (clean.startsWith("/projects/")) return "/projects/[id]";
  if (clean.startsWith("/admin")) return "/admin";
  return clean;
}

export function computeSessions(events: AnalyticsEventRecord[]): SessionMetrics[] {
  const bySession = new Map<string, AnalyticsEventRecord[]>();
  for (const event of events) {
    if (!event.session_id) continue;
    const list = bySession.get(event.session_id) ?? [];
    list.push(event);
    bySession.set(event.session_id, list);
  }

  const sessions: SessionMetrics[] = [];
  for (const [sessionId, list] of bySession) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.client_ts).getTime() - new Date(b.client_ts).getTime()
    );
    if (sorted.length === 0) continue;

    const startMs = new Date(sorted[0].client_ts).getTime();
    let endMs = startMs;
    let heartbeatMinutes = 0;

    for (let i = 0; i < sorted.length; i += 1) {
      const ts = new Date(sorted[i].client_ts).getTime();
      if (i > 0) {
        const prev = new Date(sorted[i - 1].client_ts).getTime();
        if (ts - prev <= SESSION_GAP_MS) {
          endMs = Math.max(endMs, ts);
        }
      } else {
        endMs = ts;
      }
      if (sorted[i].event_name === "studio_heartbeat") {
        heartbeatMinutes += HEARTBEAT_MS / 60_000;
      }
    }

    const spanMinutes = Math.max(0, (endMs - startMs) / 60_000);
    const durationMinutes = Math.max(spanMinutes, heartbeatMinutes, 0.5);

    sessions.push({
      sessionId,
      userId: sorted[0].user_id,
      startMs,
      endMs,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
      startDateKey: formatDateKey(startOfUtcDay(new Date(startMs))),
    });
  }

  return sessions;
}

export type DurationBucket = "0-1" | "1-5" | "5-15" | "15-30" | "30+";

export function bucketSessionDuration(minutes: number): DurationBucket {
  if (minutes < 1) return "0-1";
  if (minutes < 5) return "1-5";
  if (minutes < 15) return "5-15";
  if (minutes < 30) return "15-30";
  return "30+";
}

export function computePageDwellMinutes(events: AnalyticsEventRecord[]): Map<string, number> {
  const bySession = new Map<string, AnalyticsEventRecord[]>();
  for (const event of events) {
    if (event.event_name !== "page_view" && event.event_name !== "studio_heartbeat") continue;
    const list = bySession.get(event.session_id) ?? [];
    list.push(event);
    bySession.set(event.session_id, list);
  }

  const totals = new Map<string, number>();

  for (const list of bySession.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.client_ts).getTime() - new Date(b.client_ts).getTime()
    );
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const path =
        current.event_name === "studio_heartbeat"
          ? "/studio"
          : normalizePagePath(current.properties?.path);
      const start = new Date(current.client_ts).getTime();
      const next = sorted[i + 1];
      const end = next
        ? Math.min(new Date(next.client_ts).getTime(), start + SESSION_GAP_MS)
        : start + (current.event_name === "studio_heartbeat" ? HEARTBEAT_MS : 60_000);
      const minutes = Math.max(0, (end - start) / 60_000);
      totals.set(path, (totals.get(path) ?? 0) + minutes);
    }
  }

  return totals;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return Math.round((sorted[idx] ?? 0) * 10) / 10;
}

export function buildActivityHeatmap(
  events: AnalyticsEventRecord[]
): Array<{ day: number; hour: number; users: number }> {
  const grid = new Map<string, Set<string>>();
  for (const event of events) {
    if (!event.user_id) continue;
    const date = new Date(event.client_ts);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.getUTCDay();
    const hour = date.getUTCHours();
    const key = `${day}:${hour}`;
    const set = grid.get(key) ?? new Set<string>();
    set.add(event.user_id);
    grid.set(key, set);
  }

  return [...grid.entries()].map(([key, users]) => {
    const [day, hour] = key.split(":").map(Number);
    return { day, hour, users: users.size };
  });
}

export function computeModuleDwellMinutes(events: AnalyticsEventRecord[]): Map<string, number> {
  const MODULE_BY_EVENT: Record<string, string> = {
    intent_agent_start: "Intent",
    intent_turn: "Intent",
    modify_start: "Modify",
    modify_complete: "Modify",
    studio_enter: "Studio",
    studio_heartbeat: "Studio",
    project_ready: "Preview",
    page_view: "Browse",
  };

  const totals = new Map<string, number>();
  const bySession = new Map<string, AnalyticsEventRecord[]>();
  for (const event of events) {
    const list = bySession.get(event.session_id) ?? [];
    list.push(event);
    bySession.set(event.session_id, list);
  }

  for (const list of bySession.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.client_ts).getTime() - new Date(b.client_ts).getTime()
    );
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const module = MODULE_BY_EVENT[current.event_name];
      if (!module) continue;
      const start = new Date(current.client_ts).getTime();
      const next = sorted[i + 1];
      const end = next
        ? Math.min(new Date(next.client_ts).getTime(), start + SESSION_GAP_MS)
        : start + (current.event_name === "studio_heartbeat" ? HEARTBEAT_MS : 60_000);
      const minutes = Math.max(0, (end - start) / 60_000);
      totals.set(module, (totals.get(module) ?? 0) + minutes);
    }
  }

  return totals;
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
