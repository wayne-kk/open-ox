import type { ContextEvent, ContextEventStore, NewContextEvent } from "./types";

export class InMemoryContextEventStore implements ContextEventStore {
  private readonly sessions = new Map<string, ContextEvent[]>();

  async append(sessionId: string, events: readonly NewContextEvent[]): Promise<readonly ContextEvent[]> {
    const sessionEvents = this.sessions.get(sessionId) ?? [];
    const appended = events.map((event, index) => {
      const sequence = sessionEvents.length + index + 1;
      return {
        ...event,
        id: `${sessionId}:${sequence}`,
        sessionId,
        sequence,
        createdAt: new Date().toISOString(),
      } as ContextEvent;
    });
    sessionEvents.push(...appended);
    this.sessions.set(sessionId, sessionEvents);
    return appended;
  }

  async read(sessionId: string, afterSequence = 0): Promise<readonly ContextEvent[]> {
    return (this.sessions.get(sessionId) ?? []).filter((event) => event.sequence > afterSequence);
  }
}
