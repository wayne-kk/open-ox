"use client";

import { useRouter } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { navigateAppBack } from "@/lib/navigation/appBack";
import { cn } from "@/lib/utils";

type AppBackButtonProps = {
  fallback?: string;
  className?: string;
  title?: string;
};

export function AppBackButton({
  fallback = "/dashboard",
  className,
  title = "返回上一页",
}: AppBackButtonProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => navigateAppBack(router, { fallback })}
      className={cn(className)}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
    </button>
  );
}
