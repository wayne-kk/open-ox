import { AsyncLocalStorage } from "node:async_hooks";

/** v1: parent may spawn once; subagents cannot spawn further. */
export const MAX_SUBAGENT_DEPTH = 1;

const depthStore = new AsyncLocalStorage<number>();

export function getSubagentDepth(): number {
  return depthStore.getStore() ?? 0;
}

export function assertCanSpawnSubagent(): void {
  const depth = getSubagentDepth();
  if (depth >= MAX_SUBAGENT_DEPTH) {
    throw new Error(
      `Subagent nesting limit exceeded (max depth ${MAX_SUBAGENT_DEPTH}). Nested spawn_subagent is not allowed.`
    );
  }
}

export async function withSubagentDepth<T>(fn: () => Promise<T>): Promise<T> {
  const next = getSubagentDepth() + 1;
  return depthStore.run(next, fn);
}
