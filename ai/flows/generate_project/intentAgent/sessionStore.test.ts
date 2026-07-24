import fs from "fs/promises";
import path from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { testRoot } = vi.hoisted(() => ({
  testRoot: `/tmp/open-ox-intent-session-${process.pid}`,
}));
vi.mock("@/lib/projectManager", () => ({
  WORKSPACE_ROOT: testRoot,
  getSiteRoot: (projectId: string) => path.join(testRoot, "sites", projectId),
}));

import {
  getIntentAgentSessionPath,
  loadIntentAgentSession,
  saveIntentAgentSession,
} from "./sessionStore";

beforeEach(async () => {
  process.env.AGENT_CONTEXT_V2_INTENT = "1";
  await fs.rm(testRoot, { recursive: true, force: true });
});
afterAll(async () => {
  delete process.env.AGENT_CONTEXT_V2_INTENT;
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe("Intent Agent session V2", () => {
  it("migrates V1 messages to a reload-verified append-only event log", async () => {
    const projectId = "migration-test";
    const file = getIntentAgentSessionPath(projectId);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({
      version: 1, projectId, updatedAt: "old", turnCounter: 1,
      messages: [{ role: "system", content: "Help." }, { role: "user", content: "First" }],
    }));
    const v1 = await loadIntentAgentSession(projectId);
    expect(v1?.messages).toHaveLength(2);
    await saveIntentAgentSession({ ...v1!, messages: [...v1!.messages, { role: "assistant", content: "Answer" }] });
    const metadata = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    expect(metadata.version).toBe(2);
    await expect(fs.access(path.join(path.dirname(file), "intent-agent-session.migrated-v1.json"))).resolves.toBeUndefined();
    expect((await loadIntentAgentSession(projectId))?.messages.map((message) => message.content))
      .toEqual(["Help.", "First", "Answer"]);

    const current = (await loadIntentAgentSession(projectId))!;
    await saveIntentAgentSession({ ...current, turnCounter: 2, messages: [...current.messages, { role: "user", content: "Second" }] });
    expect((await loadIntentAgentSession(projectId))?.messages).toHaveLength(4);

    delete process.env.AGENT_CONTEXT_V2_INTENT;
    const v2 = (await loadIntentAgentSession(projectId))!;
    await saveIntentAgentSession({ ...v2, messages: [...v2.messages, { role: "assistant", content: "Still V2" }] });
    expect(JSON.parse(await fs.readFile(file, "utf8")).version).toBe(2);
  });
});
