/** sessionStorage key for the in-app page to return to after leaving Studio / fullscreen views */
export const APP_RETURN_TO_KEY = "open-ox:app-return-to";

const SAFE_PREFIXES = [
  "/",
  "/dashboard",
  "/projects",
  "/studio",
  "/docs",
  "/auth",
  "/community",
  "/llm-test",
  "/changelog",
] as const;

/** Map legacy workspace list URLs to /dashboard (keep /projects/:id). */
export function migrateWorkspacePath(path: string): string {
  if (path === "/projects" || path.startsWith("/projects?")) {
    return `/dashboard${path.slice("/projects".length)}`;
  }
  return path;
}

export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  const pathOnly = path.split("?")[0] ?? path;
  return SAFE_PREFIXES.some(
    (prefix) =>
      pathOnly === prefix ||
      (prefix !== "/" && pathOnly.startsWith(`${prefix}/`))
  );
}

/** Remember where the user was before opening a nested route (e.g. Studio). */
export function captureAppReturnTo(path?: string): void {
  if (typeof window === "undefined") return;
  const target = migrateWorkspacePath(
    path ?? `${window.location.pathname}${window.location.search}`
  );
  if (!isSafeInternalPath(target)) return;
  try {
    sessionStorage.setItem(APP_RETURN_TO_KEY, target);
  } catch {
    /* quota / private mode */
  }
}

export function peekAppReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(APP_RETURN_TO_KEY);
    if (stored && isSafeInternalPath(stored)) return migrateWorkspacePath(stored);
  } catch {
    /* ignore */
  }
  return null;
}

export function clearAppReturnTo(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(APP_RETURN_TO_KEY);
  } catch {
    /* ignore */
  }
}

type AppRouter = { back: () => void; push: (href: string) => void };

/**
 * Navigate back to the page the user came from:
 * 1. Explicit return path captured before entering Studio
 * 2. Browser history (router.back)
 * 3. Fallback (default `/dashboard`)
 */
export function navigateAppBack(
  router: AppRouter,
  options?: { fallback?: string }
): void {
  const fallback = options?.fallback ?? "/dashboard";
  const stored = peekAppReturnTo();
  if (stored) {
    clearAppReturnTo();
    router.push(stored);
    return;
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}
