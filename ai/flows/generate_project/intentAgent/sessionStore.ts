/**
 * Resumeable task-agent session for project intent (yield / commit).
 */
import fs from "fs/promises";
import path from "path";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getSiteRoot } from "@/lib/projectManager";

export const INTENT_AGENT_SESSION_FILE = "intent-agent-session.json";

export interface IntentAgentPersistedSessionV1 {
  version: 1;
  projectId: string;
  updatedAt: string;
  turnCounter: number;
  messages: ChatMessage[];
}

function sessionDir(projectId: string): string {
  return path.join(getSiteRoot(projectId), ".open-ox");
}

export function getIntentAgentSessionPath(projectId: string): string {
  return path.join(sessionDir(projectId), INTENT_AGENT_SESSION_FILE);
}

export async function loadIntentAgentSession(
  projectId: string
): Promise<IntentAgentPersistedSessionV1 | null> {
  const file = getIntentAgentSessionPath(projectId);
  try {
    const raw = await fs.readFile(file, "utf-8");
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

export async function saveIntentAgentSession(session: IntentAgentPersistedSessionV1): Promise<void> {
  const dir = sessionDir(session.projectId);
  await fs.mkdir(dir, { recursive: true });
  const next: IntentAgentPersistedSessionV1 = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  const file = getIntentAgentSessionPath(session.projectId);
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf-8");
}

export async function clearIntentAgentSession(projectId: string): Promise<void> {
  try {
    await fs.unlink(getIntentAgentSessionPath(projectId));
  } catch {
    // ignore
  }
}

/** Safer project ids (matches typical open-ox ids). */
export function isSafeProjectId(projectId: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(projectId);
}
