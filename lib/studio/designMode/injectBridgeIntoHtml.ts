/** Inject the Design Mode bridge script tag into exported static HTML. */

import { getSiteOrigin, isDedicatedPreviewOrigin } from "@/lib/previewOrigin";

export function designModeBridgeScriptPath(): string {
  // Must NOT live under /studio/* — that prefix is auth-gated in proxy.ts,
  // and the preview iframe (other origin/port) cannot send Studio cookies.
  // On a dedicated preview host, use the Studio origin so `/open-ox/…` is not
  // mistaken for `/{projectId}` by host rewrites.
  if (isDedicatedPreviewOrigin()) {
    const site = getSiteOrigin();
    if (site) return `${site}/open-ox/design-mode-bridge.js`;
  }
  return "/open-ox/design-mode-bridge.js";
}

/**
 * Next.js font preloads use `crossorigin` (anonymous), which forces
 * credentials:omit — the preview grant cookie is never sent → 403 on woff2.
 * Same-origin preview assets do not need CORS mode; strip it on the way out.
 */
export function stripCrossoriginFromPreviewFontLinks(html: string): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\bas\s*=\s*(["']?)font\1/i.test(tag)) return tag;
    return tag.replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, "");
  });
}

export function injectDesignModeBridgeIntoHtml(html: string, scriptSrc: string): string {
  const prepared = stripCrossoriginFromPreviewFontLinks(html);
  const safeSrc = scriptSrc.replace(/"/g, "&quot;");
  const tag = `<script src="${safeSrc}" defer data-open-ox-design-bridge></script>`;
  if (prepared.includes("</head>")) {
    return prepared.replace("</head>", `  ${tag}\n</head>`);
  }
  if (prepared.includes("<body")) {
    return prepared.replace(/<body([^>]*)>/i, `<body$1>\n${tag}`);
  }
  return `${tag}\n${prepared}`;
}

export function shouldInjectDesignModeBridge(relPath: string, contentType: string): boolean {
  const lower = relPath.toLowerCase();
  const isHtml =
    lower.endsWith(".html") ||
    lower === "index.html" ||
    contentType.includes("text/html");
  return isHtml;
}
