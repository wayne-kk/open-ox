import type { BoardRun } from "./boardRunTypes";

/**
 * Persistence contract for BoardRun hydration after Studio refresh.
 * v0.1: one active board per project (incomplete or proposed).
 */
export interface BoardRunStore {
  loadActive(projectId: string): Promise<BoardRun | null>;
  save(run: BoardRun): Promise<void>;
  clear(projectId: string): Promise<void>;
}

/** In-memory store for unit tests and single-process dogfood until DB wiring. */
export class MemoryBoardRunStore implements BoardRunStore {
  private readonly byProject = new Map<string, BoardRun>();

  async loadActive(projectId: string): Promise<BoardRun | null> {
    return this.byProject.get(projectId) ?? null;
  }

  async save(run: BoardRun): Promise<void> {
    this.byProject.set(run.projectId, structuredClone(run));
  }

  async clear(projectId: string): Promise<void> {
    this.byProject.delete(projectId);
  }
}
