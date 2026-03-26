"use client";

import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";
import { useBuildStudio } from "./hooks/useBuildStudio";
import { BuildConversation } from "./components/BuildConversation";
import { GenerationAtlas } from "./components/GenerationAtlas";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BuildStudioPage() {
  const studio = useBuildStudio();
  const { loading, response, elapsed } = studio;
  const buildSteps = response?.buildSteps ?? [];

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

      <div className="relative z-1 flex h-full flex-col">
        <header className="border-b border-white/8 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex items-center justify-between gap-4 px-6 py-2 lg:px-8">
            <div className="flex items-center gap-4">
              <Link href="/" className="defi-button-outline px-4 py-2 text-[11px] font-medium">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
                  Build Studio
                </div>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  OPEN-OX DEFI BUILD CONSOLE
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="defi-badge px-3 py-1 text-primary">build_site</span>
              <span className="defi-badge px-3 py-1 text-accent-tertiary">live telemetry</span>
              <span className="hidden font-mono uppercase tracking-[0.26em] text-muted-foreground sm:inline">
                bounded planning + repair branch
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full min-h-0 flex-1 flex-col  overflow-hidden lg:flex-row ">
          <BuildConversation {...studio} />

          <section className="defi-glass flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    topology only
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-foreground">
                    {loading
                      ? `running build_site · ${formatMs(elapsed)}`
                      : response
                        ? `build_site · ${buildSteps.length} steps`
                        : "console idle"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {loading ? (
                  <span className="defi-badge px-3 py-1 text-primary">network live</span>
                ) : response ? (
                    <span className={`defi-badge px-3 py-1 ${response.error
                      ? "border border-red-400/35 text-red-400"
                      : response.verificationStatus === "failed"
                        ? "border border-amber-400/35 text-amber-300"
                        : "text-accent-tertiary"
                      }`}>
                    {response.error
                      ? "failed"
                      : response.verificationStatus === "failed"
                        ? "unvalidated"
                        : response.buildTotalDuration
                          ? `done · ${formatMs(response.buildTotalDuration)}`
                          : "done"}
                  </span>
                ) : (
                      <span className="font-mono uppercase tracking-[0.26em] text-muted-foreground">standby</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))] px-5 py-4 font-mono text-[12px]">
              <div className="flex h-full min-h-0 flex-col p-4">
                <GenerationAtlas
                  steps={buildSteps}
                  flowStart={studio.flowStart}
                  loading={loading}
                  verificationStatus={response?.verificationStatus}
                  totalDuration={response?.buildTotalDuration}
                  showEventStream={false}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
