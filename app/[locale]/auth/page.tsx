"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Component } from "@/components/ui/animated-characters-login-page";

function AuthFallback() {
  const t = useTranslations("auth");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {t("loading")}
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
