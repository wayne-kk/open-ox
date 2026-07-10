/** Dispatched after folder create / rename / dissolve so AppShell can refresh. */
export const FOLDERS_CHANGED_EVENT = "open-ox:folders-changed";

export function notifyFoldersChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));
}

/** True when URL folder param means workspace root (outermost). */
export function isRootFolderParam(folder: string | null | undefined): boolean {
  return !folder || folder === "all" || folder === "uncategorized";
}

/** Only real folder UUIDs are valid create targets; ignore all / uncategorized. */
export function resolveFolderIdFromSearchParam(folder: string | null | undefined): string | null {
  if (isRootFolderParam(folder)) return null;
  return folder ?? null;
}
