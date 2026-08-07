/** Dispatched after Studio records a project open so AppShell can refresh. */
export const RECENT_PROJECTS_CHANGED_EVENT = "open-ox:recent-projects-changed";

export const RECENT_PROJECTS_LIMIT = 10;

export function notifyRecentProjectsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECENT_PROJECTS_CHANGED_EVENT));
}
