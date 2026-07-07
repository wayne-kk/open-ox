/** Inject the Design Mode bridge script tag into exported static HTML. */

export function designModeBridgeScriptPath(): string {
  return "/studio/design-mode-bridge.js";
}

export function injectDesignModeBridgeIntoHtml(html: string, scriptSrc: string): string {
  const safeSrc = scriptSrc.replace(/"/g, "&quot;");
  const tag = `<script src="${safeSrc}" defer data-open-ox-design-bridge></script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${tag}\n</head>`);
  }
  if (html.includes("<body")) {
    return html.replace(/<body([^>]*)>/i, `<body$1>\n${tag}`);
  }
  return `${tag}\n${html}`;
}

export function shouldInjectDesignModeBridge(relPath: string, contentType: string): boolean {
  const lower = relPath.toLowerCase();
  const isHtml =
    lower.endsWith(".html") ||
    lower === "index.html" ||
    contentType.includes("text/html");
  return isHtml;
}
