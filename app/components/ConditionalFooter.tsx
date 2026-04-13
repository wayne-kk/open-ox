"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

const HIDE_FOOTER_ROUTES = ["/projects/", "/studio/", "/auth"];

export function ConditionalFooter() {
  const pathname = usePathname();
  if (HIDE_FOOTER_ROUTES.some((route) => pathname.startsWith(route))) return null;
  return <Footer />;
}
