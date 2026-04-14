"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminUser {
  userId: string;
  role: "admin";
  createdAt: string;
  email: string | null;
  name: string;
}

interface DirectoryUser {
  userId: string;
  email: string | null;
  name: string;
  createdAt: string | null;
}

interface AdminUsersResponse {
  me: string;
  admins: AdminUser[];
  users: DirectoryUser[];
}

export function AdminUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (nextQuery = query) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        perPage: "10",
      });
      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      }
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = (await res.json()) as AdminUsersResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load admins");
      }
      const payload = data as AdminUsersResponse;
      setAdmins(payload.admins);
      setMe(payload.me);
      setUsers(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadData(query);
  }, [loadData, query]);

  async function toggleAdmin(userId: string, nextIsAdmin: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/admin/users",
        nextIsAdmin
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ userId }),
            }
          : {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ userId }),
            }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update admin role");
      }
      await loadData(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(searchText.trim());
  }

  const adminIds = new Set(admins.map((a) => a.userId));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <form className="mb-3 flex gap-2" onSubmit={onSearchSubmit}>
          <input
            className="h-10 flex-1 rounded-md border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-primary/50"
            placeholder="搜索名字"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="h-10 rounded-md border border-white/20 bg-white/5 px-4 text-sm disabled:opacity-50"
            disabled={loading}
          >
            搜索
          </button>
        </form>

        <div className="overflow-hidden rounded-md border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">名字</th>
                <th className="px-3 py-2">是否管理员</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={2}>
                    没有数据
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isAdmin = adminIds.has(user.userId);
                  const isSelfAdmin = user.userId === me && isAdmin;
                  return (
                    <tr key={user.userId} className="border-t border-white/10">
                      <td className="px-3 py-2">{user.name}</td>
                      <td className="px-3 py-2">
                        <button
                          className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-40 ${isAdmin
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-white/20 bg-white/5 text-muted-foreground"
                            }`}
                          disabled={submitting || isSelfAdmin}
                          onClick={() => void toggleAdmin(user.userId, !isAdmin)}
                          title={isSelfAdmin ? "不能取消自己的管理员权限" : "点击切换"}
                        >
                          {isAdmin ? "是" : "否"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">最近 10 个用户。搜索后显示匹配结果前 10 条。</p>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </main>
  );
}
