import type { BoardRun } from "./boardRunTypes";

/**
 * True when Studio should block plain Modify / Design Mode Direct Apply
 * until the board is finished, cancelled, or declined.
 */
export function isBoardRunBlocking(run: BoardRun | null | undefined): boolean {
  if (!run) return false;
  switch (run.status) {
    case "proposed":
    case "running":
    case "paused":
    case "failed":
      return true;
    case "completed":
    case "cancelled":
      return false;
    default:
      return false;
  }
}
