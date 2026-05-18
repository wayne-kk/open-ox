/**
 * Next `basePath` prefixes `/_next` but still emits `/images/...` for `public/` files in static export HTML/JS/CSS.
 * Rewrite those root-absolute URLs so previews load under `/site-previews/{id}/...` in the parent app.
 */
export function rewriteExportedPublicRootPathsInText(
  content: string,
  basePath: string,
  segments: readonly string[]
): string {
  if (segments.length === 0) return content;
  let out = content;
  for (const seg of segments) {
    const esc = seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`"\\/${esc}/`, "g"), `"${basePath}/${seg}/`);
    out = out.replace(new RegExp(`'\\/${esc}/`, "g"), `'${basePath}/${seg}/`);
    out = out.replace(new RegExp(`"\\/${esc}"`, "g"), `"${basePath}/${seg}"`);
    out = out.replace(new RegExp(`'\\/${esc}'`, "g"), `'${basePath}/${seg}'`);
    out = out.replace(new RegExp(`url\\(/${esc}/`, "g"), `url(${basePath}/${seg}/`);
    out = out.replace(new RegExp(`url\\('/${esc}/`, "g"), `url('${basePath}/${seg}/`);
    out = out.replace(new RegExp(`url\\("/${esc}/`, "g"), `url("${basePath}/${seg}/`);
  }
  return out;
}
