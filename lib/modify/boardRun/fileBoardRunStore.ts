import fs from "fs/promises";
import path from "path";
import { getSiteRoot } from "@/lib/projectManager";
import type { BoardRun } from "./boardRunTypes";
import type { BoardRunStore } from "./boardRunStore";

function boardRunPath(projectId: string): string {
  return path.join(getSiteRoot(projectId), ".ox", "board-run.json");
}

function isBoardRun(value: unknown): value is BoardRun {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.projectId === "string" &&
    typeof r.goal === "string" &&
    typeof r.status === "string" &&
    Array.isArray(r.tasks)
  );
}

/** Durable BoardRun store under the project site root (survives Studio refresh). */
export class FileBoardRunStore implements BoardRunStore {
  async loadActive(projectId: string): Promise<BoardRun | null> {
    const file = boardRunPath(projectId);
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isBoardRun(parsed)) return null;
      if (parsed.projectId !== projectId) return null;
      return parsed;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return null;
      throw err;
    }
  }

  async save(run: BoardRun): Promise<void> {
    const file = boardRunPath(run.projectId);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(run, null, 2), "utf8");
  }

  async clear(projectId: string): Promise<void> {
    const file = boardRunPath(projectId);
    try {
      await fs.unlink(file);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return;
      throw err;
    }
  }
}

let defaultStore: BoardRunStore | null = null;

export function getBoardRunStore(): BoardRunStore {
  if (!defaultStore) defaultStore = new FileBoardRunStore();
  return defaultStore;
}

/** Test-only override. */
export function __setBoardRunStoreForTests(store: BoardRunStore | null): void {
  defaultStore = store;
}
