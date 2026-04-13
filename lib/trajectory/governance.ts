import type { TrajectoryEvent } from "./schema";

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /(password|token|secret|api[_-]?key)\s*[:=]\s*["']?[^"',\s]+["']?/gi,
];

const CANARY_PATTERNS: RegExp[] = [
  /open-ox-canary/gi,
  /zz_canary_/gi,
  /honeytoken/gi,
];

function redactString(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function redactValue<T>(value: T): T {
  if (typeof value === "string") return redactString(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactValue(v)) as T;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) next[k] = redactValue(v);
    return next as T;
  }
  return value;
}

export function detectCanary(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return CANARY_PATTERNS.some((p) => p.test(text));
}

export function computeFieldCoverage(records: Array<{ events: TrajectoryEvent[] }>) {
  const required = [
    "schema_version",
    "task_id",
    "run_id",
    "event_id",
    "seq",
    "ts",
    "phase",
    "event_type",
    "actor",
    "payload",
  ];
  let total = 0;
  const hits: Record<string, number> = Object.fromEntries(required.map((k) => [k, 0]));
  for (const record of records) {
    for (const evt of record.events) {
      total += 1;
      for (const key of required) {
        if ((evt as Record<string, unknown>)[key] !== undefined && (evt as Record<string, unknown>)[key] !== null) {
          hits[key] += 1;
        }
      }
    }
  }
  const coverage: Record<string, number> = {};
  for (const key of required) {
    coverage[key] = total === 0 ? 0 : Number((hits[key] / total).toFixed(4));
  }
  return { total_events: total, fields: coverage };
}

