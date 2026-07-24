import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import type { ContextEvent, ContextEventStore, NewContextEvent } from "./types";

export class JsonlContextEventStore implements ContextEventStore {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly rootDirectory: string) {}

  private readonly blobThresholdBytes = 32_768;

  private async externalize(value: unknown): Promise<unknown> {
    if (typeof value === "string" && Buffer.byteLength(value, "utf8") >= this.blobThresholdBytes) {
      const digest = createHash("sha256").update(value).digest("hex");
      const directory = path.join(this.rootDirectory, "blobs");
      const file = path.join(directory, `${digest}.txt`);
      await fs.mkdir(directory, { recursive: true });
      try { await fs.writeFile(file, value, { encoding: "utf8", flag: "wx" }); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      return { $agentContextBlob: digest, bytes: Buffer.byteLength(value, "utf8") };
    }
    if (Array.isArray(value)) return Promise.all(value.map((entry) => this.externalize(entry)));
    if (!value || typeof value !== "object") return value;
    const entries = await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await this.externalize(entry)] as const));
    return Object.fromEntries(entries);
  }

  private async hydrate(value: unknown): Promise<unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.$agentContextBlob === "string") {
        return fs.readFile(path.join(this.rootDirectory, "blobs", `${record.$agentContextBlob}.txt`), "utf8");
      }
      const entries = await Promise.all(Object.entries(record).map(async ([key, entry]) => [key, await this.hydrate(entry)] as const));
      return Object.fromEntries(entries);
    }
    if (Array.isArray(value)) return Promise.all(value.map((entry) => this.hydrate(entry)));
    return value;
  }

  private file(sessionId: string): string {
    if (!/^[a-zA-Z0-9_.:-]{1,240}$/.test(sessionId)) {
      throw new Error(`Invalid AgentContext session id: ${sessionId}`);
    }
    return path.join(this.rootDirectory, `${encodeURIComponent(sessionId)}.jsonl`);
  }

  async append(sessionId: string, events: readonly NewContextEvent[]): Promise<readonly ContextEvent[]> {
    const previous = this.queues.get(sessionId) ?? Promise.resolve();
    let appended: readonly ContextEvent[] = [];
    const operation = previous.then(async () => {
      const existing = await this.read(sessionId);
      appended = events.map((event, index) => ({
        ...event,
        id: `${sessionId}:${existing.length + index + 1}`,
        sessionId,
        sequence: existing.length + index + 1,
        createdAt: new Date().toISOString(),
      } as ContextEvent));
      await fs.mkdir(this.rootDirectory, { recursive: true });
      const persisted = await Promise.all(appended.map((event) => this.externalize(event)));
      await fs.appendFile(this.file(sessionId), persisted.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
    });
    this.queues.set(sessionId, operation.catch(() => undefined));
    await operation;
    return appended;
  }

  async read(sessionId: string, afterSequence = 0): Promise<readonly ContextEvent[]> {
    try {
      const content = await fs.readFile(this.file(sessionId), "utf8");
      const parsed = content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
      const hydrated = await Promise.all(parsed.map((event) => this.hydrate(event) as Promise<ContextEvent>));
      return hydrated.filter((event) => event.sessionId === sessionId && event.sequence > afterSequence);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
