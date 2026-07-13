"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProjectPublishState = {
  publishPreview: boolean;
  allowRemix: boolean;
  staticPreviewSyncedAt: string | null;
};

type PatchResult =
  | { ok: true; state: ProjectPublishState }
  | { ok: false; code?: string; error: string };

function hasStaticPreview(syncedAt: string | null | undefined): boolean {
  return typeof syncedAt === "string" && syncedAt.trim().length > 0;
}

export async function patchProjectPublish(
  projectId: string,
  patch: { publishPreview?: boolean; allowRemix?: boolean }
): Promise<PatchResult> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      publishPreview?: boolean;
      allowRemix?: boolean;
      staticPreviewSyncedAt?: string | null;
    };
    if (!res.ok) {
      return {
        ok: false,
        code: typeof body.code === "string" ? body.code : undefined,
        error:
          typeof body.error === "string" && body.error.trim()
            ? body.error.trim()
            : `请求失败（${res.status}）`,
      };
    }
    return {
      ok: true,
      state: {
        publishPreview: body.publishPreview === true,
        allowRemix: body.allowRemix === true,
        staticPreviewSyncedAt: body.staticPreviewSyncedAt ?? null,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "网络错误",
    };
  }
}

export async function fetchProjectPublishState(
  projectId: string
): Promise<ProjectPublishState | null> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      publishPreview?: boolean;
      allowRemix?: boolean;
      staticPreviewSyncedAt?: string | null;
    };
    return {
      publishPreview: body.publishPreview === true,
      allowRemix: body.allowRemix === true,
      staticPreviewSyncedAt: body.staticPreviewSyncedAt ?? null,
    };
  } catch {
    return null;
  }
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  busy,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-muted"
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-[12px] font-medium text-foreground">{label}</div>
        {description ? (
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-primary/50 bg-primary/80"
            : "border-border bg-muted",
          (disabled || busy) && "pointer-events-none"
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] left-[1px] h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform",
            checked && "translate-x-[14px] bg-primary-foreground"
          )}
        />
      </button>
    </label>
  );
}

export function ProjectPublishToggles({
  projectId,
  initial,
  compact,
  onStateChange,
}: {
  projectId: string;
  initial?: Partial<ProjectPublishState> | null;
  compact?: boolean;
  onStateChange?: (state: ProjectPublishState) => void;
}) {
  const [state, setState] = useState<ProjectPublishState>({
    publishPreview: initial?.publishPreview === true,
    allowRemix: initial?.allowRemix === true,
    staticPreviewSyncedAt: initial?.staticPreviewSyncedAt ?? null,
  });
  const [loading, setLoading] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setState({
        publishPreview: initial.publishPreview === true,
        allowRemix: initial.allowRemix === true,
        staticPreviewSyncedAt: initial.staticPreviewSyncedAt ?? null,
      });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchProjectPublishState(projectId).then((next) => {
      if (cancelled) return;
      if (next) setState(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, initial?.publishPreview, initial?.allowRemix, initial?.staticPreviewSyncedAt]);

  const apply = useCallback(
    async (patch: { publishPreview?: boolean; allowRemix?: boolean }) => {
      setBusy(true);
      setError(null);
      const result = await patchProjectPublish(projectId, patch);
      setBusy(false);
      if (!result.ok) {
        if (result.code === "STATIC_PREVIEW_REQUIRED") {
          setError("需要先有可用的静态预览才能发布到社区");
        } else {
          setError(result.error);
        }
        return;
      }
      setState(result.state);
      onStateChange?.(result.state);
    },
    [onStateChange, projectId]
  );

  const previewReady = hasStaticPreview(state.staticPreviewSyncedAt);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        加载发布状态…
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", compact ? "min-w-[220px]" : "min-w-[260px]")}>
      <ToggleRow
        label="发布预览"
        description={
          previewReady
            ? "上架社区，他人可打开静态预览"
            : "需先生成静态预览后才能开启"
        }
        checked={state.publishPreview}
        disabled={!previewReady && !state.publishPreview}
        busy={busy}
        onChange={(next) => void apply({ publishPreview: next })}
      />
      <ToggleRow
        label="允许 Remix"
        description="拷贝许可（日后可收费）"
        checked={state.allowRemix}
        disabled={!state.publishPreview}
        busy={busy}
        onChange={(next) => void apply({ allowRemix: next })}
      />
      {error ? (
        <p className="px-2 pt-1 text-[10px] leading-relaxed text-red-400/90">{error}</p>
      ) : null}
    </div>
  );
}

/** Studio header “发布” dropdown. */
export function StudioPublishMenu({
  projectId,
  initial,
}: {
  projectId: string;
  initial?: Partial<ProjectPublishState> | null;
}) {
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(initial?.publishPreview === true);

  useEffect(() => {
    if (initial?.publishPreview !== undefined) {
      setPublished(initial.publishPreview === true);
    }
  }, [initial?.publishPreview]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] transition-colors",
            published
              ? "border-primary/35 bg-primary/12 text-primary hover:bg-primary/18"
              : "border-border bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <Globe2 className="h-3 w-3" />
          发布
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[280px] border-border bg-popover p-2 text-popover-foreground shadow-[var(--box-shadow-neon-lg)]"
      >
        <div className="mb-1 px-2 pb-1.5 pt-0.5">
          <p className="text-[11px] font-medium text-foreground">发布到社区</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/65">
            社区仅展示静态预览；他人不能进入 Studio
          </p>
        </div>
        {open ? (
          <ProjectPublishToggles
            projectId={projectId}
            initial={initial}
            onStateChange={(s) => setPublished(s.publishPreview)}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
