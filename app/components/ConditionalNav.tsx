"use client";

import { Navigation } from "./Navigation";
import { useAuthUser } from "./AuthHeaderActions";
import { usePathname } from "@/i18n/navigation";

/**
 * Hide global top nav on Studio/auth/project detail, and on workspace shell routes:
 * `/dashboard` (always) and `/community` when logged in
 * (shell lives in `app/[locale]/(workspace)/layout.tsx`).
 */
export function ConditionalNav() {
  const pathname = usePathname();
  const { user, ready } = useAuthUser();

  if (pathname.startsWith("/studio/") || pathname.startsWith("/auth")) return null;
  if (pathname.startsWith("/projects/")) return null;
  if (pathname === "/dashboard") return null;
  // Workspace settings share AppShell — hide marketing top nav (same as dashboard).
  if (pathname.startsWith("/settings")) return null;
  if (pathname === "/community" && ready && user) return null;

  return <Navigation />;
}
