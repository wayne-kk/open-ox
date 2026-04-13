"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";

/** 这些路由有全屏/独立布局；`/projects` 列表仍显示全局导航 */
const HIDE_NAV_ROUTES = ["/projects/", "/studio/", "/auth"];

export function ConditionalNav() {
  const pathname = usePathname();
  if (HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route))) return null;
  return <Navigation />;
}
