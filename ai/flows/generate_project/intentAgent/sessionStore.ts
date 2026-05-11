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

export const INTENT_AGENT_SESSION_FILE = "intent-agent-session.json";

export interface IntentAgentPersistedSessionV1 {
  version: 1;
  projectId: string;
  updatedAt: string;
  turnCounter: number;
  messages: ChatMessage[];
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

export async function loadIntentAgentSession(
  projectId: string
): Promise<IntentAgentPersistedSessionV1 | null> {
  const primary = getIntentAgentSessionPath(projectId);
  try {
    const raw = await fs.readFile(primary, "utf-8");
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
  const next: IntentAgentPersistedSessionV1 = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  const file = getIntentAgentSessionPath(session.projectId);
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf-8");
  try {
    await fs.unlink(legacySessionPath(session.projectId));
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
}

/** Safer project ids (matches typical open-ox ids). */
export function isSafeProjectId(projectId: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(projectId);
}
