"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inferMonacoLanguage } from "../lib/inferMonacoLanguage";

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
    const part = parts[i];
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
  const keys = [...b.dirs.keys()].sort((a, c) => a.localeCompare(c));
  for (const k of keys) {
    sortBranch(b.dirs.get(k)!);
  }
}

function buildTree(paths: string[]): Branch {
  const root: Branch = { dirs: new Map(), files: [] };
  for (const p of paths) insertPath(root, p);
  sortBranch(root);
  return root;
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
              className="flex w-full items-center gap-0.5 py-1 text-left font-mono text-[11px] text-muted-foreground/85 hover:bg-white/5 hover:text-foreground"
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
              active ? "bg-primary/15 text-primary" : "text-muted-foreground/90 hover:bg-white/5 hover:text-foreground",
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

export function ProjectCodePanel({ projectId }: { projectId: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const editorRef = useRef<{
    getAction: (id: string) => { run: () => void | Promise<void> } | null;
  } | null>(null);

  const dirty = selectedPath != null && content !== savedContent;

  const tree = useMemo(() => buildTree(paths), [paths]);

  const loadFileList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files?source=workspace`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const list = Array.isArray(data.files) ? (data.files as string[]) : [];
      setPaths(list);
      setSelectedPath((prev) => (prev && list.includes(prev) ? prev : list[0] ?? null));
      // expand first segment paths for nicer UX
      const next = new Set<string>();
      for (const p of list) {
        const parts = p.split("/").filter(Boolean);
        let acc = "";
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
          next.add(acc);
        }
      }
      setExpanded(next);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to list files");
      setPaths([]);
    } finally {
      setListLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadFileList();
  }, [loadFileList]);

  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      setSavedContent("");
      setFileError(null);
      return;
    }

    const path = selectedPath;
    const controller = new AbortController();
    async function load() {
      setFileLoading(true);
      setFileError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
          { signal: controller.signal },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const text = typeof data.content === "string" ? data.content : "";
        setContent(text);
        setSavedContent(text);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setContent("");
        setSavedContent("");
        setFileError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setFileLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [projectId, selectedPath]);

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

  const saveFile = useCallback(async () => {
    if (!selectedPath || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSavedContent(content);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [projectId, selectedPath, content, dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveFile]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectFile = useCallback(
    (path: string) => {
      if (path === selectedPath) return;
      if (dirty) {
        const ok = window.confirm("Leave this file? Unsaved changes will be lost.");
        if (!ok) return;
      }
      setSelectedPath(path);
    },
    [selectedPath, dirty],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.18))]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
          <FileCode2 className="h-3.5 w-3.5 text-primary/70" />
          <span>Workspace</span>
          {paths.length > 0 && (
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground/60">
              {paths.length} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void downloadWorkspaceZip()}
            disabled={exportingZip}
            className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Pack local workspace (fast). First download or stale files: Refresh explorer or use Export API ?sync=1 to merge Storage before zipping."
          >
            <Download className={cn("mr-1 inline h-3 w-3", exportingZip && "animate-pulse")} />
            {exportingZip ? "ZIP…" : "ZIP"}
          </button>
          <button
            type="button"
            onClick={() => void editorRef.current?.getAction("actions.find")?.run()}
            disabled={!selectedPath || fileLoading}
            className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search className="mr-1 inline h-3 w-3" />
            Find
          </button>
          <button
            type="button"
            onClick={() => void loadFileList()}
            disabled={listLoading}
            className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn("mr-1 inline h-3 w-3", listLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void saveFile()}
            disabled={!dirty || saving || !selectedPath}
            className="rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary/90 transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="mr-1 inline h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/10 px-3 py-1.5 font-mono text-[10px] text-red-300/90">
          {saveError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[min(280px,38%)] shrink-0 flex-col border-r border-white/8 bg-black/20">
          <div className="shrink-0 border-b border-white/6 px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            Explorer
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-unified py-1">
            {listLoading && (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground/70">Loading tree…</p>
            )}
            {listError && (
              <p className="px-3 py-2 font-mono text-[11px] text-red-300/85">{listError}</p>
            )}
            {!listLoading && !listError && paths.length === 0 && (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground/70">No files yet.</p>
            )}
            {!listLoading && !listError && paths.length > 0 && (
              <FileTree
                branch={tree}
                pathPrefix=""
                depth={0}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center border-b border-white/8 px-3 font-mono text-[10px] text-muted-foreground/70">
            <span className="truncate">{selectedPath ?? "Select a file"}</span>
            {dirty && <span className="ml-2 text-amber-400/90">● unsaved</span>}
          </div>
          <div className="relative min-h-0 flex-1">
            {fileLoading && (
              <div className="p-4 font-mono text-[11px] text-muted-foreground/70">Loading file…</div>
            )}
            {fileError && !fileLoading && (
              <div className="p-4 font-mono text-[11px] text-red-300/85">{fileError}</div>
            )}
            {!fileLoading && !fileError && selectedPath && (
              <div className="absolute inset-0 min-h-[200px]">
                <MonacoEditor
                  height="100%"
                  language={inferMonacoLanguage(selectedPath)}
                  theme="vs-dark"
                  value={content}
                  path={selectedPath}
                  onChange={(v) => setContent(v ?? "")}
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
            {!fileLoading && !selectedPath && !fileError && (
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
