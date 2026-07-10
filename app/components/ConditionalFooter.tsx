"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { useAuthUser } from "./AuthHeaderActions";

export function ConditionalFooter() {
  const pathname = usePathname();
  const { user, ready } = useAuthUser();

  if (pathname.startsWith("/studio/") || pathname.startsWith("/auth")) return null;
  if (pathname.startsWith("/projects/")) return null;
  if (pathname === "/dashboard") return null;
  if (pathname === "/community" && ready && user) return null;

  return <Footer />;
}
