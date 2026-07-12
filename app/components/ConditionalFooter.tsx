"use client";

import { Footer } from "./Footer";
import { useAuthUser } from "./AuthHeaderActions";
import { usePathname } from "@/i18n/navigation";

/**
 * Hide marketing footer on Studio/auth/project detail, and on workspace shell routes
 * (`/dashboard`, `/settings/*`, logged-in `/community`) — same surfaces as ConditionalNav.
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  const { user, ready } = useAuthUser();

  if (pathname.startsWith("/studio/") || pathname.startsWith("/auth")) return null;
  if (pathname.startsWith("/projects/")) return null;
  if (pathname === "/dashboard") return null;
  if (pathname.startsWith("/settings")) return null;
  if (pathname === "/community" && ready && user) return null;

  return <Footer />;
}
