import { buildSectionFileStem, slugToPagePath } from "./paths";
import type { PlannedSectionSpec } from "../types";

function sectionComponentName(scopeSlug: string, fileName: string): string {
  const stem = buildSectionFileStem(scopeSlug, fileName);
  const parts = stem.split("_").filter(Boolean);
  if (parts.length === 0) return "Section";
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function sectionImportPath(scopeSlug: string, fileName: string): string {
  const stem = buildSectionFileStem(scopeSlug, fileName);
  return `@/components/sections/${stem}`;
}

export function buildReplicaPageSource(params: {
  slug: string;
  sections: PlannedSectionSpec[];
}): { pagePath: string; source: string } {
  const { slug, sections } = params;
  const pagePath = slugToPagePath(slug);
  const pageFnName =
    slug === "home" ? "HomePage" : `${sectionComponentName(slug, slug)}Page`;

  const imports = sections
    .map((section) => {
      const name = sectionComponentName(slug, section.fileName);
      return `import ${name} from "${sectionImportPath(slug, section.fileName)}";`;
    })
    .join("\n");

  const body = sections
    .map((section) => {
      const name = sectionComponentName(slug, section.fileName);
      return `      <${name} />`;
    })
    .join("\n");

  const source = `${imports}

export default function ${pageFnName}() {
  return (
    <main className="flex flex-col">
${body}
    </main>
  );
}
`;

  return { pagePath, source };
}
