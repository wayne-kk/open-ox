"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthUserValue = {
  user: User | null;
  ready: boolean;
};

const AuthUserContext = createContext<AuthUserValue | null>(null);

/**
 * Lives in the root layout so locale navigations do not remount the session
 * listener and flash the "not ready" skeleton.
 */
export function AuthUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, ready }), [user, ready]);

  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
}

export function useAuthUserContext(): AuthUserValue {
  const ctx = useContext(AuthUserContext);
  if (!ctx) {
    throw new Error("useAuthUserContext must be used within AuthUserProvider");
  }
  return ctx;
}
