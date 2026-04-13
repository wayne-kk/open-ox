import { AsyncLocalStorage } from "node:async_hooks";

export type PromptProfile = "web" | "app";

const promptProfileStorage = new AsyncLocalStorage<PromptProfile>();

export function getPromptProfile(): PromptProfile {
  return promptProfileStorage.getStore() ?? "web";
}

export async function withPromptProfile<T>(
  profile: PromptProfile,
  runner: () => Promise<T>
): Promise<T> {
  return promptProfileStorage.run(profile, runner);
}
