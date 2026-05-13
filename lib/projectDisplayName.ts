/**
 * Project names shown in list cards and synced from blueprint `brief.projectTitle`.
 * Keep concise so UI truncates rarely.
 */
export const PROJECT_LIST_NAME_MAX_CHARS = 56;

/**
 * Trim, collapse whitespace, and shorten at a word boundary when possible.
 */
export function clampProjectListName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t.length) return "";
  if (t.length <= PROJECT_LIST_NAME_MAX_CHARS) return t;

  const slice = t.slice(0, PROJECT_LIST_NAME_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > PROJECT_LIST_NAME_MAX_CHARS * 0.45) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}
