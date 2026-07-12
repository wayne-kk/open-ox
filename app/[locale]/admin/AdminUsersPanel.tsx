"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UserActivityStatus, UserDirectoryRow } from "@/lib/admin/userDirectory";

type Pagination = {
  q: string;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  role: string;
  activation: string;
  status: string;
};

const STATUS_LABEL: Record<UserActivityStatus, string> = {
  active: "活跃",
  silent: "沉默",
  churned: "流失",
  never: "从未活跃",
};

const STATUS_CLASS: Record<UserActivityStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  silent: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  churned: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  never: "bg-white/5 text-muted-foreground border-white/10",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function selectClassName() {
  return "h-9 rounded-md border border-white/15 bg-black/20 px-2 text-xs outline-none focus:border-primary/50";
}

export function AdminUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "member">("all");
  const [activation, setActivation] = useState<"all" | "activated" | "not_activated">("all");
  const [status, setStatus] = useState<"all" | UserActivityStatus>("all");
  const [page, setPage] = useState(1);
  const [me, setMe] = useState("");
  const [users, setUsers] = useState<UserDirectoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "20",
        role,
        activation,
        status,
      });
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = (await res.json()) as {
        success?: boolean;
        me?: string;
        users?: UserDirectoryRow[];
        pagination?: Pagination;
        error?: string;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? "Failed to load users");
      }
      setMe(data.me ?? "");
      setUsers(data.users ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activation, page, query, role, status]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleAdmin(userId: string, nextIsAdmin: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: nextIsAdmin ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? "Failed to update admin role");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(searchText.trim());
  }

  function onFilterChange<T extends string>(setter: (value: T) => void, value: T) {
    setPage(1);
    setter(value);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            目录、活跃状态与管理员角色
            {pagination ? ` · 共 ${pagination.total} 人` : null}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <form className="flex flex-wrap gap-2" onSubmit={onSearchSubmit}>
          <input
            className="h-9 min-w-[220px] flex-1 rounded-md border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-primary/50"
            placeholder="搜索邮箱 / 名字 / userId"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="h-9 rounded-md border border-white/20 bg-white/5 px-4 text-sm disabled:opacity-50"
            disabled={loading}
          >
            搜索
          </button>
          <select
            className={selectClassName()}
            value={role}
            onChange={(e) =>
              onFilterChange(setRole, e.target.value as "all" | "admin" | "member")
            }
          >
            <option value="all">全部角色</option>
            <option value="admin">仅管理员</option>
            <option value="member">非管理员</option>
          </select>
          <select
            className={selectClassName()}
            value={activation}
            onChange={(e) =>
              onFilterChange(
                setActivation,
                e.target.value as "all" | "activated" | "not_activated"
              )
            }
          >
            <option value="all">激活不限</option>
            <option value="activated">已激活（Ready≥1）</option>
            <option value="not_activated">未激活</option>
          </select>
          <select
            className={selectClassName()}
            value={status}
            onChange={(e) =>
              onFilterChange(setStatus, e.target.value as "all" | UserActivityStatus)
            }
          >
            <option value="all">状态不限</option>
            <option value="active">活跃（7 日内）</option>
            <option value="silent">沉默（7–30 日）</option>
            <option value="churned">流失（&gt;30 日）</option>
            <option value="never">从未活跃</option>
          </select>
        </form>

        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">用户</th>
                <th className="px-3 py-2">注册</th>
                <th className="px-3 py-2">最后活跃</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">项目</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">登录</th>
                <th className="px-3 py-2">管理员</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                    加载中…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                    没有匹配用户
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelfAdmin = user.userId === me && user.isAdmin;
                  return (
                    <tr key={user.userId} className="border-t border-white/10 align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email ?? "—"}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {user.isInternal ? (
                            <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              内部
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            title="复制 userId"
                            onClick={() => void navigator.clipboard.writeText(user.userId)}
                          >
                            {user.userId.slice(0, 8)}…
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {formatDate(user.registeredAt)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {formatDateTime(user.lastActiveAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] ${STATUS_CLASS[user.activityStatus]}`}
                        >
                          {STATUS_LABEL[user.activityStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span className="text-foreground">{user.projectCount}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-emerald-300">{user.readyCount} Ready</span>
                        {user.modifyCount > 0 ? (
                          <div className="text-muted-foreground">{user.modifyCount} modify</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {user.creditBalance == null ? (
                          "—"
                        ) : (
                          <>
                            <span>{user.creditBalance}</span>
                            <span className="ml-1 text-muted-foreground">
                              {user.creditPlan ?? "free"}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">
                        {user.provider}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-40 ${
                            user.isAdmin
                              ? "border-primary/35 bg-primary/15 text-primary"
                              : "border-white/20 bg-white/5 text-muted-foreground"
                          }`}
                          disabled={submitting || isSelfAdmin}
                          onClick={() => void toggleAdmin(user.userId, !user.isAdmin)}
                          title={isSelfAdmin ? "不能取消自己的管理员权限" : "点击切换"}
                        >
                          {user.isAdmin ? "是" : "否"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/users/${user.userId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          详情
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              第 {pagination.page} / {pagination.totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-white/15 px-3 py-1.5 disabled:opacity-40"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className="rounded border border-white/15 px-3 py-1.5 disabled:opacity-40"
                disabled={loading || page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
