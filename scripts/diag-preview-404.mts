/**
 * Feedback loop: start local preview and assert root is not 404.
 * Usage: OPEN_OX_PREVIEW_BACKEND=local pnpm exec tsx --env-file=.env.local scripts/diag-preview-404.mts [projectId]
 */
process.env.OPEN_OX_PREVIEW_BACKEND = "local";
if (!process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";
}

import { createClient } from "@supabase/supabase-js";

const id = process.argv[2] ?? "2026-07-12T04-52-26-826Z_project";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function looksLike404(status: number, body: string): boolean {
  if (status === 404) return true;
  if (/This page could not be found/i.test(body)) return true;
  if (/<title[^>]*>\s*404\s*</i.test(body)) return true;
  return false;
}

async function main() {
  const { startLocalDevServer } = await import("../lib/localDevServerManager.ts");
  console.log(`[diag] starting local preview for ${id}`);
  const t0 = Date.now();
  const result = await startLocalDevServer(sb, id);
  console.log(`[diag] started in ${Date.now() - t0}ms url=${result.url} port=${result.port}`);

  let red = 0;
  for (let i = 0; i < 12; i++) {
    const urls = [result.url, `${result.url}/`];
    for (const url of urls) {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
      const body = await r.text();
      const bad = looksLike404(r.status, body);
      if (bad) red += 1;
      console.log(
        JSON.stringify({
          i,
          url,
          status: r.status,
          len: body.length,
          bad,
          title: (body.match(/<title>([^<]*)/) || [])[1] ?? null,
        })
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (red > 0) {
    console.error(`[diag] RED: ${red} responses looked like 404`);
    process.exit(2);
  }
  console.log("[diag] GREEN: no 404-like responses");
}

main().catch((e) => {
  console.error("[diag] FAIL", e);
  process.exit(1);
});
