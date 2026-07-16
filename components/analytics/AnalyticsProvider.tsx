"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ensureAcquisitionCaptured,
  startStudioHeartbeat,
  trackPageView,
} from "@/lib/analytics/client";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    ensureAcquisitionCaptured();
  }, []);

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/studio")) return;
    return startStudioHeartbeat(pathname);
  }, [pathname]);

  return children;
}
