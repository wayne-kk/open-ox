"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";

type AuthConfig = {
  googleLoginEnabled?: boolean;
  feishuLoginEnabled?: boolean;
  linuxdoLoginEnabled?: boolean;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LinuxDoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3.2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 13.6c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  );
}

const btnBase =
  "relative flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition";

function oauthErrorKey(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "config":
      return "config";
    case "auth":
      return "auth";
    case "google_config":
      return "googleConfig";
    case "google_start":
      return "googleStart";
    case "feishu_denied":
      return "feishuDenied";
    case "feishu_state":
    case "linuxdo_state":
      return "state";
    case "feishu_config":
    case "feishu_secret":
      return "feishuConfig";
    case "feishu_token":
    case "feishu_profile":
    case "feishu_auth":
      return "feishuFailed";
    case "linuxdo_denied":
      return "linuxdoDenied";
    case "linuxdo_config":
    case "linuxdo_secret":
      return "linuxdoConfig";
    case "linuxdo_token":
    case "linuxdo_profile":
    case "linuxdo_auth":
      return "linuxdoFailed";
    default:
      return null;
  }
}

/**
 * Unified third-party login stack. Fetches /api/auth/config once. 需在 Suspense 内使用。
 */
export function SocialAuthSection() {
  const t = useTranslations("auth.oauth");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("msg");
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    if (error === "auth") {
      console.warn("[auth] OAuth code exchange failed");
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d: AuthConfig) => {
        if (!cancelled) setConfig(d);
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({
            googleLoginEnabled: false,
            feishuLoginEnabled: false,
            linuxdoLoginEnabled: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const next = encodeURIComponent(redirect);
  const errorKey = oauthErrorKey(error);
  const errorCopy = errorKey ? t(`errors.${errorKey}`) : null;
  const loading = config === null;
  const googleOn = config?.googleLoginEnabled === true;
  const linuxdoOn = config?.linuxdoLoginEnabled === true;
  const feishuOn = config?.feishuLoginEnabled === true;
  const anyOn = googleOn || linuxdoOn || feishuOn;

  if (!loading && !anyOn && !errorCopy) {
    return null;
  }

  return (
    <div className="mt-6 space-y-2.5">
      {errorCopy && (
        <p className="text-center text-sm text-red-400">
          {errorCopy}
          {errorDetail ? (
            <span className="mt-1 block break-all text-[11px] text-red-400/70">{errorDetail}</span>
          ) : null}
        </p>
      )}

      {loading ? (
        <div className="flex w-full justify-center rounded-xl border border-border bg-muted/40 py-3 text-xs text-muted-foreground">
          {t("checking")}
        </div>
      ) : (
        <>
          {googleOn && (
            <Link
              href={`/api/auth/google/start?next=${next}`}
              className={`${btnBase} border-border/60 bg-background text-foreground hover:bg-muted/50`}
            >
              <GoogleIcon className="h-4 w-4" />
              {t("google")}
            </Link>
          )}

          {linuxdoOn && (
            <Link
              href={`/api/auth/linuxdo/start?next=${next}`}
              className={`${btnBase} border-orange-500/35 bg-orange-500/10 text-orange-200 hover:bg-orange-500/18`}
            >
              <LinuxDoIcon className="h-4 w-4 text-orange-400" />
              {t("linuxdo")}
            </Link>
          )}

          {feishuOn && (
            <Link
              href={`/api/auth/feishu/start?next=${next}`}
              className={`${btnBase} border-[#3370ff]/30 bg-[#3370ff]/8 text-[#8eb5ff]/90 hover:bg-[#3370ff]/14`}
            >
              <MessagesSquare className="h-4 w-4 text-[#3370ff]" />
              {t("feishu")}
              <span className="absolute right-3 rounded border border-[#3370ff]/25 bg-[#3370ff]/10 px-1.5 py-0.5 text-[10px] font-normal leading-none text-[#8eb5ff]/75">
                {t("feishuInternal")}
              </span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
