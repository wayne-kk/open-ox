"use client";

import { Suspense } from "react";
import { Component } from "@/components/ui/animated-characters-login-page";

function AuthFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
      加载…
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Component />
    </Suspense>
  );
}
