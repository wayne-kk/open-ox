"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";

/**
 * 飞书授权入口 + URL 上的错误提示（回调重定向带 ?error= / msg=）。需在 Suspense 内使用。
 */
export function FeishuAuthBlock() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/projects";
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("msg");
  const [feishuEnabled, setFeishuEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (error === "auth") {
      console.warn("[auth] OAuth code exchange failed");
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d: { feishuLoginEnabled?: boolean }) => {
        if (!cancelled) setFeishuEnabled(d.feishuLoginEnabled === true);
      })
      .catch(() => {
        if (!cancelled) setFeishuEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const feishuStartUrl = `/api/auth/feishu/start?next=${encodeURIComponent(redirect)}`;

  const feishuErrorCopy =
    error === "feishu_denied"
      ? "已取消飞书授权。"
      : error === "feishu_state"
        ? "登录状态失效，请重试。"
        : error === "feishu_config"
          ? "服务端未配置飞书应用（FEISHU_APP_ID / SECRET）或缺少 Service Role。"
          : error === "feishu_secret"
            ? "服务端未配置 FEISHU_OAUTH_HMAC_SECRET。"
            : error === "feishu_token" || error === "feishu_profile"
              ? "飞书接口错误，请稍后重试。"
              : error === "feishu_auth"
                ? "无法创建登录会话。"
                : null;

  return (
    <div className="mt-6 space-y-3">
      {error === "config" && (
        <p className="text-center text-sm text-red-400">服务端未配置 Supabase。</p>
      )}
      {error === "auth" && (
        <p className="text-center text-sm text-red-400">第三方登录回调失败，请重试。</p>
      )}
      {feishuErrorCopy && (
        <p className="text-center text-sm text-red-400">
          {feishuErrorCopy}
          {errorDetail ? (
            <span className="mt-1 block break-all text-[11px] text-red-400/70">{errorDetail}</span>
          ) : null}
        </p>
      )}

      {feishuEnabled === false ? (
        <p className="text-center text-xs text-muted-foreground/90 leading-relaxed">
          飞书登录未启用：请在部署环境配置{" "}
          <span className="font-mono text-[10px] text-muted-foreground">
            FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_OAUTH_HMAC_SECRET、SUPABASE_SERVICE_ROLE_KEY
          </span>
          ，并将飞书后台重定向 URL 设为{" "}
          <span className="font-mono text-[10px] break-all text-muted-foreground">
            {"{你的站点}/api/auth/feishu/callback"}
          </span>
          ，且 <span className="font-mono text-[10px]">NEXT_PUBLIC_SITE_URL</span> 与线上域名一致。
        </p>
      ) : (
        <>
          <p className="text-center text-xs text-muted-foreground">
            使用飞书时将跳转授权，登录后回到站点（无需在 Supabase 配置飞书 Issuer）
          </p>

          {feishuEnabled === null ? (
            <div className="flex w-full justify-center rounded-xl border border-white/8 bg-white/[0.03] py-3 text-xs text-muted-foreground">
              检查登录方式…
            </div>
          ) : (
            <Link
              href={feishuStartUrl}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3370ff]/35 bg-[#3370ff]/10 py-3 text-sm font-medium text-[#8eb5ff] transition hover:bg-[#3370ff]/18"
            >
              <MessagesSquare className="h-4 w-4 text-[#3370ff]" />
              使用飞书登录
            </Link>
          )}
        </>
      )}
    </div>
  );
}
