"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { captureAppReturnTo } from "@/lib/navigation/appBack";

type Phase = "starting" | "error";

/**
 * Opened in a new tab from the projects list (⌘/Ctrl+click or middle-click).
 * Ensures dev server via POST /preview, then navigates to the returned URL — avoids popup blockers.
 */
export default function PreviewLaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runLaunch = useCallback(async () => {
    setPhase("starting");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/preview`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (!res.ok) {
        const err =
          typeof body.error === "string" && body.error.trim()
            ? body.error.trim()
            : `请求失败（${res.status}）`;
        setPhase("error");
        setErrorMessage(err);
        return;
      }
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url) {
        setPhase("error");
        setErrorMessage("未返回预览地址");
        return;
      }
      window.location.replace(url);
    } catch (e) {
      setPhase("error");
      setErrorMessage(e instanceof Error ? e.message : "网络错误");
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void runLaunch();
    });
  }, [runLaunch]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090e] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c0f16] p-8 shadow-xl shadow-black/40">
        {phase === "starting" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <div className="space-y-1">
              <h1 className="font-heading text-[15px] font-semibold tracking-tight">正在启动预览…</h1>
              <p className="text-[12px] leading-relaxed text-white/45">
                首次打开可能需要十多秒，请留在本标签页。
              </p>
            </div>
          </div>
        )}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="font-heading text-[15px] font-semibold text-red-400/95">预览无法打开</p>
            <p className="min-h-[2.5rem] text-[12px] leading-relaxed text-white/55">{errorMessage}</p>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => void runLaunch()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/15 px-4 py-2.5 text-[12px] font-medium text-primary hover:bg-primary/22"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-[12px] font-medium text-white/75 hover:bg-white/[0.06]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                返回列表
              </Link>
              <Link
                href={`/studio/${id}`}
                onClick={() => captureAppReturnTo("/projects")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-[12px] font-medium text-white/75 hover:bg-white/[0.06]"
              >
                进入 Studio
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
