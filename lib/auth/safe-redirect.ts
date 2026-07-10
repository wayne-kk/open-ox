/** Same-origin path only — prevents open redirects after login. */
export function safeRedirectTarget(pathWithQuery: string): string {
  if (!pathWithQuery.startsWith("/") || pathWithQuery.startsWith("//")) {
    return "/dashboard";
  }
  // Marketing home is anonymous-only; send post-login traffic to the workspace.
  const pathOnly = pathWithQuery.split("?")[0] ?? pathWithQuery;
  if (pathOnly === "/") {
    return "/dashboard";
  }
  return pathWithQuery;
}
