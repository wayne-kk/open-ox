"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";

// These routes have their own custom headers
const HIDE_NAV_ROUTES = ["/projects/", "/studio/"];

export function ConditionalNav() {
    const pathname = usePathname();
    if (HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route))) return null;
    return <Navigation />;
}
