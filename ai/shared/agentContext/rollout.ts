import type { ContextSessionKind } from "./types";

const ROLLOUT_FLAG_BY_KIND: Record<ContextSessionKind, string | undefined> = {
  page: "AGENT_CONTEXT_V2_PAGE",
  scaffold: "AGENT_CONTEXT_V2_PAGE",
  chrome: "AGENT_CONTEXT_V2_PAGE",
  intent: "AGENT_CONTEXT_V2_INTENT",
  modify: undefined,
  subagent: undefined,
};

export function isAgentContextV2Enabled(kind: ContextSessionKind): boolean {
  const flag = ROLLOUT_FLAG_BY_KIND[kind];
  return flag !== undefined && process.env[flag] === "1";
}
