"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  success?: boolean;
  data?: { maintenance?: boolean };
  error?: string | null;
};

export function MaintenanceModeSwitch({
  maintenance,
  disabled,
  onToggle,
}: {
  maintenance: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={maintenance}
      aria-label="项目生成维护模式"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-wait disabled:opacity-60",
        maintenance ? "border-primary/40 bg-primary" : "border-border bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute left-1 top-1 h-6 w-6 translate-x-0 rounded-full bg-white shadow-sm transition-transform duration-200",
          maintenance && "translate-x-6"
        )}
      />
    </button>
  );
}

export function AdminSystemSettingsPanel() {
  const [maintenance, setMaintenance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSetting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-settings/project-creation", {
        cache: "no-store",
      });
      const json = (await response.json()) as SettingsResponse;
      if (!response.ok || !json.success || typeof json.data?.maintenance !== "boolean") {
        throw new Error(json.error ?? "无法读取系统设置");
      }
      setMaintenance(json.data.maintenance);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取系统设置");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSetting();
  }, [loadSetting]);

  const updateSetting = async () => {
    const next = !maintenance;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-settings/project-creation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance: next }),
      });
      const json = (await response.json()) as SettingsResponse;
      if (!response.ok || !json.success || typeof json.data?.maintenance !== "boolean") {
        throw new Error(json.error ?? "无法更新系统设置");
      }
      setMaintenance(json.data.maintenance);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "无法更新系统设置");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">系统设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">控制影响全站的运行时功能状态</p>
      </div>

      <section className="max-w-3xl border-y border-border py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground">
              <Wrench className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">项目生成维护模式</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                开启后禁止创建新项目，并将所有生成入口引导至维护页。已有项目和其他功能不受影响。
              </p>
              <div className="mt-3 flex min-h-5 items-center gap-2 text-xs">
                {loading || saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-muted-foreground">
                      {loading ? "读取中…" : "保存中…"}
                    </span>
                  </>
                ) : (
                  <span className={maintenance ? "text-amber-400" : "text-emerald-400"}>
                    {maintenance ? "维护模式已开启，新项目生成已暂停" : "维护模式已关闭，新项目生成正常"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <MaintenanceModeSwitch
            maintenance={maintenance}
            disabled={loading || saving}
            onToggle={() => void updateSetting()}
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </section>
    </div>
  );
}
