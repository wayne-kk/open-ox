"use client";

type AuthProfile = {
  isAdmin: boolean;
};

let cached: AuthProfile | null = null;
let inflight: Promise<AuthProfile> | null = null;

/** Deduped client fetch for server-only fields (e.g. admin role). */
export function loadAuthProfile(): Promise<AuthProfile> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = fetch("/api/auth/user")
    .then(async (res) => {
      if (!res.ok) return { isAdmin: false };
      const data = (await res.json()) as { isAdmin?: boolean; user?: unknown | null };
      if (!data.user) return { isAdmin: false };
      return { isAdmin: data.isAdmin === true };
    })
    .catch(() => ({ isAdmin: false }))
    .then((profile) => {
      cached = profile;
      inflight = null;
      return profile;
    });

  return inflight;
}

export function clearAuthProfileCache(): void {
  cached = null;
  inflight = null;
}
