"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCode2,
  File as FileIcon,
  Folder,
  RefreshCw,
  Save,
  Search,
  AlignLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inferMonacoLanguage } from "../lib/inferMonacoLanguage";
import { configureMonacoTsDefaults } from "../lib/monacoTsDefaults";
import {
  applyCleanTabRefresh,
  cleanTabsToRefetch,
  closeCodeTab,
  expandDirsForPaths,
  filterPathsByQuery,
  markTabSaved,
  needsFetchForPath,
  tabIsDirty,
  updateTabContent,
  upsertTab,
  type CodeTab,
} from "../lib/projectCodeTabs";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Branch = {
  dirs: Map<string, Branch>;
  files: Array<{ name: string; path: string }>;
};

function insertPath(root: Branch, relativePath: string): void {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return;
  let node = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i === parts.length - 1) {
      node.files.push({ name: part, path: relativePath });
    } else {
      if (!node.dirs.has(part)) {
        node.dirs.set(part, { dirs: new Map(), files: [] });
      }
      node = node.dirs.get(part)!;
    }
  }
}

function sortBranch(b: Branch): void {
  b.files.sort((a, c) => a.name.localeCompare(c.name));
  for (const child of b.dirs.values()) sortBranch(child);
}

function buildTree(paths: string[]): Branch {
  const root: Branch = { dirs: new Map(), files: [] };
  for (const p of paths) insertPath(root, p);
  sortBranch(root);
  return root;
}

function shortName(path: string): string {
  return path.split("/").pop() ?? path;
}

function FileTree({
  branch,
  pathPrefix,
  depth,
  selectedPath,
  onSelectFile,
  expanded,
  toggle,
}: {
  branch: Branch;
  pathPrefix: string;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  expanded: Set<string>;
  toggle: (key: string) => void;
}) {
  const dirEntries = [...branch.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      {dirEntries.map(([dirName, childBranch]) => {
        const fullPrefix = pathPrefix ? `${pathPrefix}/${dirName}` : dirName;
        const isOpen = expanded.has(fullPrefix);
        return (
          <div key={fullPrefix} className="min-w-0">
            <button
              type="button"
              onClick={() => toggle(fullPrefix)}
              style={{ paddingLeft: 8 + depth * 12 }}
              className="flex w-full items-center gap-0.5 py-1 text-left font-mono text-[11px] text-muted-foreground/85 hover:bg-muted hover:text-foreground"
            >
              {isOpen ? (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 opacity-70" />
              )}
              <Folder className="h-3 w-3 shrink-0 text-amber-400/70" />
              <span className="truncate">{dirName}</span>
            </button>
            {isOpen && (
              <FileTree
                branch={childBranch}
                pathPrefix={fullPrefix}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </div>
        );
      })}
      {branch.files.map((f) => {
        const active = selectedPath === f.path;
        return (
          <button
            key={f.path}
            type="button"
            onClick={() => onSelectFile(f.path)}
            style={{ paddingLeft: 8 + depth * 12 }}
            className={cn(
              "flex w-full items-center gap-1.5 py-1 text-left font-mono text-[11px] transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground/90 hover:bg-muted hover:text-foreground",
            )}
          >
            <FileIcon className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{f.name}</span>
          </button>
        );
      })}
    </>
  );
}

async function fetchFileContent(projectId: string, path: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return typeof data.content === "string" ? data.content : "";
}

async function patchFileContent(projectId: string, path: string, content: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/files`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
}

export function ProjectCodePanel({
  projectId,
  workspaceEpoch = 0,
}: {
  projectId: string;
  /** Bumped when modify writes files — refreshes clean tabs from disk. */
  workspaceEpoch?: number;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<CodeTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [pathFilter, setPathFilter] = useState("");

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const editorRef = useRef<{
    getAction: (id: string) => { run: () => void | Promise<void> } | null;
  } | null>(null);
  const listLoadedRef = useRef(false);
  const lastEpochRef = useRef(workspaceEpoch);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const dirtyCount = tabs.filter(tabIsDirty).length;
  const activeDirty = activeTab ? tabIsDirty(activeTab) : false;

  const filteredPaths = useMemo(
    () => filterPathsByQuery(paths, pathFilter),
    [paths, pathFilter],
  );
  const tree = useMemo(() => buildTree(filteredPaths), [filteredPaths]);

  const loadFileList = useCallback(async (): Promise<string[]> => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files?source=workspace`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const list = Array.isArray(data.files) ? (data.files as string[]) : [];
      setPaths(list);
      listLoadedRef.current = true;
      return list;
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to list files");
      setPaths([]);
      return [];
    } finally {
      setListLoading(false);
    }
  }, [projectId]);

  const refreshFromWorkspace = useCallback(async () => {
    const list = await loadFileList();
    const current = tabsRef.current;
    const toFetch = cleanTabsToRefetch(current, list);
    const diskContents: Record<string, string> = {};
    await Promise.all(
      toFetch.map(async (path) => {
        try {
          diskContents[path] = await fetchFileContent(projectId, path);
        } catch {
          /* leave missing — applyCleanTabRefresh keeps prior clean content */
        }
      }),
    );
    const nextTabs = applyCleanTabRefresh(current, list, diskContents);
    setTabs(nextTabs);
    setActivePath((active) => {
      if (active && nextTabs.some((t) => t.path === active)) return active;
      return nextTabs[0]?.path ?? null;
    });
    const expandSeed =
      (activePath && nextTabs.some((t) => t.path === activePath) ? [activePath] : null) ??
      (nextTabs[0] ? [nextTabs[0].path] : list.slice(0, 1));
    setExpanded(expandDirsForPaths(expandSeed));
  }, [loadFileList, projectId, activePath]);

  // Initial list load once per mount (keep-alive preserves this).
  useEffect(() => {
    if (listLoadedRef.current) return;
    void (async () => {
      const list = await loadFileList();
      if (list[0]) {
        setExpanded(expandDirsForPaths([list[0]]));
      }
    })();
  }, [loadFileList]);

  // modify-complete / external epoch bump
  useEffect(() => {
    if (workspaceEpoch === lastEpochRef.current) return;
    lastEpochRef.current = workspaceEpoch;
    if (workspaceEpoch === 0) return;
    void refreshFromWorkspace();
  }, [workspaceEpoch, refreshFromWorkspace]);

  // Expand dirs when filter changes
  useEffect(() => {
    if (!pathFilter.trim()) return;
    setExpanded(expandDirsForPaths(filteredPaths.slice(0, 80)));
  }, [pathFilter, filteredPaths]);

  const openFile = useCallback(
    async (path: string) => {
      if (path === activePath) return;

      if (!needsFetchForPath(tabsRef.current, path)) {
        setActivePath(path);
        setFileError(null);
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const d of expandDirsForPaths([path])) next.add(d);
          return next;
        });
        return;
      }

      setFileLoading(true);
      setFileError(null);
      setActivePath(path);
      try {
        const text = await fetchFileContent(projectId, path);
        setTabs((prev) =>
          upsertTab(prev, { path, content: text, savedContent: text }),
        );
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const d of expandDirsForPaths([path])) next.add(d);
          return next;
        });
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setFileLoading(false);
      }
    },
    [activePath, projectId],
  );

  // Open first file once list arrives if nothing open yet
  useEffect(() => {
    if (activePath || tabs.length > 0 || paths.length === 0 || listLoading) return;
    void openFile(paths[0]!);
  }, [activePath, tabs.length, paths, listLoading, openFile]);

  const downloadWorkspaceZip = useCallback(async () => {
    setExportingZip(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (typeof parsed.error === "string") msg = parsed.error;
        } catch {
          if (!text) msg = `HTTP ${res.status}`;
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectId}.zip`;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingZip(false);
    }
  }, [projectId]);

  const saveFile = useCallback(
    async (path: string) => {
      const tab = tabsRef.current.find((t) => t.path === path);
      if (!tab || !tabIsDirty(tab)) return;
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: tab.content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTabs((prev) => markTabSaved(prev, path, tab.content));
    },
    [projectId],
  );

  const saveActive = useCallback(async () => {
    if (!activePath || !activeDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveFile(activePath);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [activePath, activeDirty, saveFile]);

  const saveAll = useCallback(async () => {
    const dirty = tabsRef.current.filter(tabIsDirty);
    if (dirty.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(dirty.map((t) => patchFileContent(projectId, t.path, t.content)));
      setTabs((prev) => {
        let next = prev;
        for (const t of dirty) {
          next = markTabSaved(next, t.path, t.content);
        }
        return next;
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save all failed");
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        if (e.shiftKey) void saveAll();
        else void saveActive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive, saveAll]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCloseTab = useCallback(
    (path: string, e?: MouseEvent) => {
      e?.stopPropagation();
      const tab = tabsRef.current.find((t) => t.path === path);
      if (tab && tabIsDirty(tab)) {
        const ok = window.confirm(`Close ${shortName(path)}? Unsaved changes will be lost.`);
        if (!ok) return;
      }
      const result = closeCodeTab(tabsRef.current, activePath, path);
      setTabs(result.tabs);
      setActivePath(result.activePath);
      setFileError(null);
    },
    [activePath],
  );

  const runEditorAction = useCallback((actionId: string) => {
    void editorRef.current?.getAction(actionId)?.run();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.18))]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
          <FileCode2 className="h-3.5 w-3.5 text-primary/70" />
          <span>Workspace</span>
          {paths.length > 0 && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground/60">
              {paths.length} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void downloadWorkspaceZip()}
            disabled={exportingZip}
            className="rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Pack local workspace (fast). First download or stale files: Refresh explorer or use Export API ?sync=1 to merge Storage before zipping."
          >
            <Download className={cn("mr-1 inline h-3 w-3", exportingZip && "animate-pulse")} />
            {exportingZip ? "ZIP…" : "ZIP"}
          </button>
          <button
            type="button"
            onClick={() => runEditorAction("actions.find")}
            disabled={!activePath || fileLoading}
            className="rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search className="mr-1 inline h-3 w-3" />
            Find
          </button>
          <button
            type="button"
            onClick={() => runEditorAction("editor.action.formatDocument")}
            disabled={!activePath || fileLoading}
            className="rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Format document"
          >
            <AlignLeft className="mr-1 inline h-3 w-3" />
            Format
          </button>
          <button
            type="button"
            onClick={() => void refreshFromWorkspace()}
            disabled={listLoading}
            className="rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn("mr-1 inline h-3 w-3", listLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={dirtyCount === 0 || saving}
            className="rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Save all dirty tabs (⌘⇧S)"
          >
            <Save className="mr-1 inline h-3 w-3" />
            {saving && dirtyCount > 1 ? "Saving…" : "Save All"}
          </button>
          <button
            type="button"
            onClick={() => void saveActive()}
            disabled={!activeDirty || saving || !activePath}
            className="rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary/90 transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
            title="Save current file (⌘S)"
          >
            <Save className="mr-1 inline h-3 w-3" />
            {saving && dirtyCount <= 1 ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/10 px-3 py-1.5 font-mono text-[10px] text-red-300/90">
          {saveError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[min(280px,38%)] shrink-0 flex-col border-r border-border bg-muted/50">
          <div className="shrink-0 space-y-1.5 border-b border-border px-2 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              Explorer
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="search"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="Filter files…"
                className="w-full rounded border border-border bg-muted py-1 pl-7 pr-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-unified py-1">
            {listLoading && paths.length === 0 && (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground/70">Loading tree…</p>
            )}
            {listError && (
              <p className="px-3 py-2 font-mono text-[11px] text-red-300/85">{listError}</p>
            )}
            {!listLoading && !listError && paths.length === 0 && (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground/70">No files yet.</p>
            )}
            {!listError && filteredPaths.length === 0 && paths.length > 0 && (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground/70">No matches.</p>
            )}
            {!listError && filteredPaths.length > 0 && (
              <FileTree
                branch={tree}
                pathPrefix=""
                depth={0}
                selectedPath={activePath}
                onSelectFile={(path) => void openFile(path)}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-border scrollbar-unified">
            {tabs.length === 0 ? (
              <div className="flex items-center px-3 font-mono text-[10px] text-muted-foreground/70">
                Select a file
              </div>
            ) : (
              tabs.map((t) => {
                const active = t.path === activePath;
                const dirty = tabIsDirty(t);
                return (
                  <div
                    key={t.path}
                    className={cn(
                      "group flex max-w-[180px] shrink-0 items-center gap-1 border-r border-border px-2 font-mono text-[10px]",
                      active
                        ? "bg-white/8 text-foreground"
                        : "text-muted-foreground/70 hover:bg-white/4 hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void openFile(t.path)}
                      className="min-w-0 truncate text-left"
                      title={t.path}
                    >
                      {dirty && <span className="mr-1 text-amber-400/90">●</span>}
                      {shortName(t.path)}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(t.path, e)}
                      className="rounded p-0.5 opacity-50 hover:bg-white/10 hover:opacity-100"
                      title="Close"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            {fileLoading && (
              <div className="p-4 font-mono text-[11px] text-muted-foreground/70">Loading file…</div>
            )}
            {fileError && !fileLoading && (
              <div className="p-4 font-mono text-[11px] text-red-300/85">{fileError}</div>
            )}
            {!fileLoading && !fileError && activeTab && (
              <div className="absolute inset-0 min-h-[200px]">
                <MonacoEditor
                  height="100%"
                  language={inferMonacoLanguage(activeTab.path)}
                  theme="vs-dark"
                  value={activeTab.content}
                  path={activeTab.path}
                  onChange={(v) =>
                    setTabs((prev) => updateTabContent(prev, activeTab.path, v ?? ""))
                  }
                  beforeMount={(monaco) => {
                    configureMonacoTsDefaults(monaco);
                  }}
                  onMount={(editor) => {
                    editorRef.current = editor as unknown as typeof editorRef.current;
                  }}
                  options={{
                    readOnly: false,
                    minimap: { enabled: true },
                    fontSize: 13,
                    lineNumbers: "on",
                    glyphMargin: false,
                    folding: true,
                    scrollBeyondLastLine: false,
                    renderLineHighlight: "line",
                    wordWrap: "on",
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              </div>
            )}
            {!fileLoading && !activeTab && !fileError && (
              <div className="flex h-full items-center justify-center p-6 font-mono text-[12px] text-muted-foreground/60">
                Pick a file from the tree to edit.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
