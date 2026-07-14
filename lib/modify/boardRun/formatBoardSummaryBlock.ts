import type { BoardRun } from "./boardRunTypes";

/** Short BoardRun context injected into Modify prompts (stable layer, not full transcripts). */
export function formatBoardSummaryBlock(
  run: BoardRun,
  currentTaskId: string
): string {
  const current = run.tasks.find((t) => t.id === currentTaskId);
  const doneLines = run.tasks
    .filter((t) => t.status === "done" || t.status === "skipped")
    .map((t) => `- [${t.status}] ${t.title}`)
    .join("\n");

  return [
    "## BoardRun context (task-slice Modify)",
    `Overall goal: ${run.goal.trim()}`,
    doneLines ? `Already completed on this board:\n${doneLines}` : "Already completed on this board: (none yet)",
    current
      ? `Current card: ${current.title}\nFocus only on this card's instruction; do not expand scope to other board cards.`
      : "Current card: (unknown)",
  ].join("\n");
}
