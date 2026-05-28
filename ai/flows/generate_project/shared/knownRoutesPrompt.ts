/**
 * Injects an authoritative route table for Architect + page agents so chrome
 * and cross-page CTAs use real Next.js paths (not `href="#"` placeholders).
 */
export function formatKnownRoutesMarkdown(
  pages: ReadonlyArray<{ title: string; slug: string }>
): string {
  if (pages.length === 0) {
    return "";
  }

  const rows = pages.map((p) => {
    const href = p.slug === "home" ? "/" : `/${p.slug}`;
    return `| ${p.title} | \`${p.slug}\` | \`${href}\` |`;
  });

  return [
    "## Known routes (authoritative for internal navigation)",
    "",
    "Every **visible internal link** in global chrome (nav, sidebar, footer) MUST use `import Link from \"next/link\"` and an `href` **exactly** equal to one of the paths in the **`href`** column. **Forbidden**: `href=\"#\"`, `/coming-soon`, or any path not listed. When the product is **single-page** only, you may still use in-page hash links for section jumps on `/` — but **do not** invent extra top-level routes.",
    "",
    "| Page title | slug | href |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
