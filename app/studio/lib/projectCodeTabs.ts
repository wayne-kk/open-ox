/** In-memory open file tab for Studio CODE panel. */
export type CodeTab = {
  path: string;
  content: string;
  savedContent: string;
};

export function tabIsDirty(tab: CodeTab): boolean {
  return tab.content !== tab.savedContent;
}

/** True when selecting `path` requires a network fetch (cache miss). */
export function needsFetchForPath(tabs: readonly CodeTab[], path: string): boolean {
  return !tabs.some((t) => t.path === path);
}

/** Open clean tabs that still exist on disk and should be re-fetched. */
export function cleanTabsToRefetch(
  tabs: readonly CodeTab[],
  listedPaths: readonly string[],
): string[] {
  const listed = new Set(listedPaths);
  return tabs.filter((t) => !tabIsDirty(t) && listed.has(t.path)).map((t) => t.path);
}

/**
 * Apply a workspace refresh to open tabs.
 * - Dirty tabs are kept as-is (even if missing from disk).
 * - Clean tabs missing from `listedPaths` are dropped.
 * - Clean tabs present in `diskContents` get content/savedContent replaced.
 * - Clean tabs not in `diskContents` are left unchanged.
 */
export function applyCleanTabRefresh(
  tabs: readonly CodeTab[],
  listedPaths: readonly string[],
  diskContents: Readonly<Record<string, string>>,
): CodeTab[] {
  const listed = new Set(listedPaths);
  const next: CodeTab[] = [];
  for (const tab of tabs) {
    if (tabIsDirty(tab)) {
      next.push(tab);
      continue;
    }
    if (!listed.has(tab.path)) continue;
    if (Object.prototype.hasOwnProperty.call(diskContents, tab.path)) {
      const content = diskContents[tab.path]!;
      next.push({ path: tab.path, content, savedContent: content });
    } else {
      next.push(tab);
    }
  }
  return next;
}

/** Close a tab; if it was active, activate a neighbor. */
export function closeCodeTab(
  tabs: readonly CodeTab[],
  activePath: string | null,
  closedPath: string,
): { tabs: CodeTab[]; activePath: string | null } {
  const idx = tabs.findIndex((t) => t.path === closedPath);
  if (idx < 0) return { tabs: [...tabs], activePath };
  const next = tabs.filter((t) => t.path !== closedPath);
  if (activePath !== closedPath) {
    return { tabs: next, activePath };
  }
  if (next.length === 0) return { tabs: next, activePath: null };
  const newIdx = Math.min(idx, next.length - 1);
  return { tabs: next, activePath: next[newIdx]!.path };
}

/** Filter workspace paths by file name or full path substring. */
export function filterPathsByQuery(paths: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...paths];
  return paths.filter((p) => {
    const name = p.split("/").pop() ?? p;
    return name.toLowerCase().includes(q) || p.toLowerCase().includes(q);
  });
}

/** Directory prefixes that should be expanded to reveal `path`. */
export function ancestorDirs(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  let acc = "";
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
    out.push(acc);
  }
  return out;
}

export function expandDirsForPaths(paths: readonly string[]): Set<string> {
  const next = new Set<string>();
  for (const p of paths) {
    for (const d of ancestorDirs(p)) next.add(d);
  }
  return next;
}

export function upsertTab(tabs: readonly CodeTab[], tab: CodeTab): CodeTab[] {
  const idx = tabs.findIndex((t) => t.path === tab.path);
  if (idx < 0) return [...tabs, tab];
  const next = [...tabs];
  next[idx] = tab;
  return next;
}

export function updateTabContent(
  tabs: readonly CodeTab[],
  path: string,
  content: string,
): CodeTab[] {
  return tabs.map((t) => (t.path === path ? { ...t, content } : t));
}

export function markTabSaved(tabs: readonly CodeTab[], path: string, content: string): CodeTab[] {
  return tabs.map((t) =>
    t.path === path ? { ...t, content, savedContent: content } : t,
  );
}
