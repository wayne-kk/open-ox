"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

/** If session exists, skip /auth and honor ?redirect=. Must be inside Suspense. */
export function AuthSessionRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectTarget(searchParams.get("redirect") ?? "/dashboard");
  const skipRedirect = searchParams.get("mode") === "reset";

  useEffect(() => {
    if (skipRedirect) return;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(redirect);
    });
  }, [redirect, router, skipRedirect]);

  return null;
}
