"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";
import { useAuthUser } from "./AuthHeaderActions";

/**
 * Hide global top nav on Studio/auth/project detail, and on workspace shell routes:
 * `/dashboard` (always) and `/community` when logged in
 * (shell lives in `app/(workspace)/layout.tsx`).
 */
export function ConditionalNav() {
  const pathname = usePathname();
  const { user, ready } = useAuthUser();

  if (pathname.startsWith("/studio/") || pathname.startsWith("/auth")) return null;
  if (pathname.startsWith("/projects/")) return null; // project detail / preview-launch
  if (pathname === "/dashboard") return null;
  if (pathname === "/community" && ready && user) return null;

  return <Navigation />;
}
