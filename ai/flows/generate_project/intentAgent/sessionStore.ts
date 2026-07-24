/**
 * Resumeable task-agent session for project intent (yield / commit).
 *
 * Session files live under the repo `.open-ox/intent-agent/{projectId}/` so the
 * generated site tree `sites/{projectId}/` stays free of engine metadata.
 */
import fs from "fs/promises";
import path from "path";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getSiteRoot, WORKSPACE_ROOT } from "@/lib/projectManager";
import { isAgentContextV2Enabled, JsonlContextEventStore } from "@/ai/shared/agentContext";
import { contextEventsToLegacyMessages, legacyMessagesToEvents } from "@/ai/shared/agentContext/legacyMessages";

export const INTENT_AGENT_SESSION_FILE = "intent-agent-session.json";
const INTENT_AGENT_MIGRATED_V1_FILE = "intent-agent-session.migrated-v1.json";

export interface IntentAgentPersistedSessionV1 {
  version: 1;
  projectId: string;
  updatedAt: string;
  turnCounter: number;
  messages: ChatMessage[];
}

interface IntentAgentPersistedSessionV2 {
  version: 2;
  projectId: string;
  updatedAt: string;
  turnCounter: number;
  messageCount: number;
  eventSessionId: string;
  sessionId: string;
  lastSequence: number;
  policyVersion: "v1";
}

function sessionDir(projectId: string): string {
  if (!isSafeProjectId(projectId)) {
    throw new Error(`Invalid projectId for intent session path: ${projectId}`);
  }
  return path.join(WORKSPACE_ROOT, ".open-ox", "intent-agent", projectId);
}

/** Pre-change location (per-site); still read once for migration. */
function legacySessionPath(projectId: string): string {
  return path.join(getSiteRoot(projectId), ".open-ox", INTENT_AGENT_SESSION_FILE);
}

export function getIntentAgentSessionPath(projectId: string): string {
  return path.join(sessionDir(projectId), INTENT_AGENT_SESSION_FILE);
}

function parsePersistedSession(raw: string): IntentAgentPersistedSessionV1 | null {
  try {
    const parsed = JSON.parse(raw) as IntentAgentPersistedSessionV1;
    if (parsed?.version !== 1 || !Array.isArray(parsed.messages) || typeof parsed.projectId !== "string") {
      return null;
    }
    if (parsed.messages.length > 0 && (parsed.messages[0] as ChatMessage).role !== "system") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseV2(raw: string): IntentAgentPersistedSessionV2 | null {
  try {
    const value = JSON.parse(raw) as IntentAgentPersistedSessionV2;
    return value?.version === 2 && typeof value.projectId === "string" &&
      Number.isSafeInteger(value.messageCount) && typeof value.eventSessionId === "string" &&
      typeof value.sessionId === "string" && Number.isSafeInteger(value.lastSequence) &&
      value.policyVersion === "v1" ? value : null;
  } catch { return null; }
}

function eventStore(projectId: string): JsonlContextEventStore {
  return new JsonlContextEventStore(path.join(sessionDir(projectId), "events"));
}

function eventSessionId(projectId: string): string {
  return `intent:${projectId}`;
}

export async function loadIntentAgentSession(
  projectId: string
): Promise<IntentAgentPersistedSessionV1 | null> {
  const primary = getIntentAgentSessionPath(projectId);
  try {
    const raw = await fs.readFile(primary, "utf-8");
    const v2 = parseV2(raw);
    if (v2 && v2.projectId === projectId) {
      const events = await eventStore(projectId).read(v2.eventSessionId);
      const messages = contextEventsToLegacyMessages(events);
      if (messages.length !== v2.messageCount || (messages[0] && messages[0].role !== "system")) return null;
      return { version: 1, projectId, updatedAt: v2.updatedAt, turnCounter: v2.turnCounter, messages };
    }
    const parsed = parsePersistedSession(raw);
    if (parsed) return parsed;
  } catch {
    /* missing or unreadable primary */
  }
  try {
    const legacyFile = legacySessionPath(projectId);
    const raw = await fs.readFile(legacyFile, "utf-8");
    const parsed = parsePersistedSession(raw);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveIntentAgentSession(session: IntentAgentPersistedSessionV1): Promise<void> {
  const dir = sessionDir(session.projectId);
  await fs.mkdir(dir, { recursive: true });
  const file = getIntentAgentSessionPath(session.projectId);
  let existingV2: IntentAgentPersistedSessionV2 | null = null;
  try { existingV2 = parseV2(await fs.readFile(file, "utf8")); } catch { /* new session */ }
  if (!isAgentContextV2Enabled("intent") && !existingV2) {
    await fs.writeFile(file, JSON.stringify({ ...session, updatedAt: new Date().toISOString() }, null, 2), "utf8");
    return;
  }
  const store = eventStore(session.projectId);
  let previousCount = existingV2?.projectId === session.projectId ? existingV2.messageCount : 0;
  const alreadyWritten = await store.read(eventSessionId(session.projectId));
  if (previousCount === 0 && alreadyWritten.length > 0) {
    const recoveredPrefix = contextEventsToLegacyMessages(alreadyWritten);
    if (JSON.stringify(recoveredPrefix) !== JSON.stringify(session.messages.slice(0, recoveredPrefix.length))) {
      throw new Error("Intent Agent V2 recovery log does not match the session prefix");
    }
    previousCount = recoveredPrefix.length;
  }
  if (previousCount > session.messages.length) {
    throw new Error("Intent Agent V2 history cannot shrink; clear the session before replacing it");
  }
  const delta = legacyMessagesToEvents(session.messages, previousCount);
  if (delta.length > 0) await store.append(eventSessionId(session.projectId), delta);
  const reloaded = await store.read(eventSessionId(session.projectId));
  if (reloaded.length !== session.messages.length) {
    throw new Error(`Intent Agent V2 reload verification failed: expected ${session.messages.length}, got ${reloaded.length}`);
  }
  if (JSON.stringify(contextEventsToLegacyMessages(reloaded)) !== JSON.stringify(session.messages)) {
    throw new Error("Intent Agent V2 identity projection verification failed");
  }
  const next: IntentAgentPersistedSessionV2 = {
    version: 2,
    projectId: session.projectId,
    updatedAt: new Date().toISOString(),
    turnCounter: session.turnCounter,
    messageCount: session.messages.length,
    eventSessionId: eventSessionId(session.projectId),
    sessionId: eventSessionId(session.projectId),
    lastSequence: reloaded.at(-1)?.sequence ?? 0,
    policyVersion: "v1",
  };
  const temporary = `${file}.tmp`;
  let primaryWasV1 = false;
  try {
    primaryWasV1 = parsePersistedSession(await fs.readFile(file, "utf8")) !== null;
  } catch { /* new session */ }
  if (primaryWasV1) {
    await fs.rename(file, path.join(dir, INTENT_AGENT_MIGRATED_V1_FILE));
  }
  await fs.writeFile(temporary, JSON.stringify(next, null, 2), "utf-8");
  await fs.rename(temporary, file);
  try {
    const legacy = legacySessionPath(session.projectId);
    await fs.rename(legacy, path.join(path.dirname(legacy), INTENT_AGENT_MIGRATED_V1_FILE));
  } catch {
    /* no legacy file */
  }
}

export async function clearIntentAgentSession(projectId: string): Promise<void> {
  try {
    await fs.unlink(getIntentAgentSessionPath(projectId));
  } catch {
    // ignore
  }
  try {
    await fs.unlink(legacySessionPath(projectId));
  } catch {
    // ignore
  }
  try {
    await fs.rm(path.join(sessionDir(projectId), "events"), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** Safer project ids (matches typical open-ox ids). */
export function isSafeProjectId(projectId: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(projectId);
}
