export const PROJECT_SOURCE_CHANGED_EVENT = "open-ox:project-source-changed";

export function notifyProjectSourceChanged(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROJECT_SOURCE_CHANGED_EVENT, { detail: { projectId } })
  );
}
