/**
 * Feedback loop for preview false-down / 404-class failures.
 *
 * Asserts the exact bug: private project with Storage index.html present, but
 * server-side health via auth-gated `/site-previews` proxy reports unreachable,
 * and ensureStaticPreviewAlive returns "down" when static_preview_synced_at is null.
 *
 * Usage:
 *   NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 pnpm exec tsx --env-file=.env.local scripts/diag-preview-404.mts [projectId]
 *
 * Exit 2 = RED (bug present). Exit 0 = GREEN.
 */
import { createClient } from "@supabase/supabase-js";

const id = process.argv[2] ?? "2026-07-12T04-52-26-826Z_project";
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: row, error } = await sb
    .from("projects")
    .select("id, static_preview_synced_at, publish_preview, files_hash")
    .eq("id", id)
    .single();
  if (error || !row) throw new Error(`project load failed: ${error?.message}`);

  const storageUrl = sb.storage
    .from("site-previews")
    .getPublicUrl(`p/${id}/index.html`).data.publicUrl;
  const storageHead = await fetch(storageUrl, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  });

  const proxySlash = `${site}/site-previews/${encodeURIComponent(id)}/`;
  const proxyNoSlash = `${site}/site-previews/${encodeURIComponent(id)}`;
  const proxyRes = await fetch(proxyNoSlash, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });

  process.env.NEXT_PUBLIC_SITE_URL = site;
  const { ensureStaticPreviewAlive } = await import("../lib/staticSitePreview");
  const alive = await ensureStaticPreviewAlive(sb, id);

  const storageOk = storageHead.ok;
  const proxyBlocked =
    row.publish_preview !== true && (proxyRes.status === 401 || proxyRes.status === 403);
  const falseDown =
    storageOk &&
    !row.static_preview_synced_at &&
    alive.status === "down";

  console.log(
    JSON.stringify(
      {
        id,
        synced_at: row.static_preview_synced_at,
        publish_preview: row.publish_preview,
        storageHead: storageHead.status,
        proxyNoSlash: proxyRes.status,
        proxySlashSample: proxySlash,
        proxyBlocked,
        alive,
        falseDown,
      },
      null,
      2
    )
  );

  // Red-capable: Storage has the object, but health says down (auth-gated probe / synced_at gap).
  if (falseDown) {
    console.error("[diag] RED: Storage index exists but ensureStaticPreviewAlive=down");
    process.exit(2);
  }

  if (!storageOk) {
    console.error("[diag] SKIP/RED: Storage index missing — cannot assert false-down bug");
    process.exit(2);
  }

  console.log("[diag] GREEN: health does not false-down when Storage index exists");
}

main().catch((e) => {
  console.error("[diag] FAIL", e);
  process.exit(1);
});
