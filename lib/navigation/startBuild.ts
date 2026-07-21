/** Anchor id of the workspace build composer (must match AppShell / dashboard). */
export const WORKSPACE_PROMPT_HASH = "workspace-prompt";

export type StartBuildAction =
  | { type: "focus" }
  | { type: "navigate"; href: string };

/**
 * Decide how "开始构建" should behave.
 * Recycle Bin hides the composer — must leave that view before focusing.
 */
export function resolveStartBuildAction(opts: {
  pathname: string;
  onTrashed: boolean;
}): StartBuildAction {
  const { pathname, onTrashed } = opts;
  if (pathname === "/dashboard" && !onTrashed) {
    return { type: "focus" };
  }
  return { type: "navigate", href: `/dashboard#${WORKSPACE_PROMPT_HASH}` };
}
