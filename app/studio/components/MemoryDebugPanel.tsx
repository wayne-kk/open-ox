"use client";

import { useState, useEffect } from "react";
import type { ModifyRecord } from "../hooks/useBuildStudio";

interface DbRecord {
  instruction: string;
  modifiedAt: string;
  touchedFiles: string[];
  summary: string;
  diffs: Array<{ file: string; additions: number; deletions: number }>;
}

interface MemoryData {
  projectId: string;
  projectName: string;
  layer1_db: { label: string; count: number; records: DbRecord[] };
  layer2_session: { label: string; note: string };
  layer3_prompt: { label: string; maxTurns: number; activeCount: number; preview: string };
}

export function MemoryDebugPanel({
  projectId,
  sessionHistory,
  externalOpen,
  onToggle,
}: {
  projectId: string | null;
  sessionHistory: ModifyRecord[];
  externalOpen?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const isOpen = externalOpen ?? false;

  const fetchMemory = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/memory`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when opened externally (e.g. /memory command)
  useEffect(() => {
    if (isOpen && !data && projectId) fetchMemory();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) return null;

  return (
    <div className="border-t border-white/8">
      <button
        type="button"
        onClick={() => { const next = !isOpen; onToggle?.(next); if (next && !data) fetchMemory(); }}
        className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
      >
        <span>Memory Debug</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 max-h-[500px] overflow-y-auto [scrollbar-width:thin]">
          {loading && <p className="text-[10px] text-muted-foreground animate-pulse">Loading...</p>}

          {data && (
            <>
              {/* Layer 1: DB */}
              <section>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-amber-300/70 mb-2">
                  {data.layer1_db.label} ({data.layer1_db.count})
                </h4>
                {data.layer1_db.records.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/30">No records in DB</p>
                ) : (
                  <div className="space-y-2">
                    {data.layer1_db.records.map((r, i) => (
                      <div key={i} className="rounded-lg border border-white/6 p-2.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] text-foreground/80 leading-5">"{r.instruction}"</p>
                          <span className="text-[9px] text-muted-foreground/30 shrink-0">{new Date(r.modifiedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50">{r.summary}</p>
                        {r.diffs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {r.diffs.map((d) => (
                              <span key={d.file} className="font-mono text-[9px] text-foreground/40">
                                {d.file} <span className="text-green-400/60">+{d.additions}</span> <span className="text-red-400/60">-{d.deletions}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Layer 2: Session */}
              <section>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-blue-300/70 mb-2">
                  Layer 2: Session History ({sessionHistory.length})
                </h4>
                <p className="text-[9px] text-muted-foreground/30 mb-2">{data.layer2_session.note}</p>
                {sessionHistory.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/30">No session records (this browser tab)</p>
                ) : (
                  <div className="space-y-1.5">
                    {sessionHistory.map((r, i) => (
                      <div key={i} className="rounded-lg border border-blue-400/10 p-2 space-y-0.5">
                        <p className="text-[11px] text-foreground/70">"{r.instruction}"</p>
                        <p className="text-[10px] text-muted-foreground/40">
                          {r.diffs.length} file(s) · {r.error ? `Error: ${r.error}` : "OK"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Layer 3: Prompt */}
              <section>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/70 mb-2">
                  {data.layer3_prompt.label} ({data.layer3_prompt.activeCount}/{data.layer3_prompt.maxTurns} turns)
                </h4>
                <pre className="rounded-lg border border-emerald-400/10 bg-emerald-400/5 p-3 text-[10px] leading-5 text-foreground/60 whitespace-pre-wrap overflow-x-hidden">
                  {data.layer3_prompt.preview}
                </pre>
              </section>
            </>
          )}

          <button
            type="button"
            onClick={fetchMemory}
            disabled={loading}
            className="text-[9px] font-mono text-primary/40 hover:text-primary/60 transition-colors disabled:opacity-30"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}
