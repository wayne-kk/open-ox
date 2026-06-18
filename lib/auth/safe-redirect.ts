/** Same-origin path only — prevents open redirects after login. */
export function safeRedirectTarget(pathWithQuery: string): string {
  if (!pathWithQuery.startsWith("/") || pathWithQuery.startsWith("//")) {
    return "/projects";
  }
  return pathWithQuery;
}
