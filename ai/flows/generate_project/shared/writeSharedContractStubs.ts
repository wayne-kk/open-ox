/**
 * Serially write shared list/detail stub components before parallel page agents.
 */

import { writeSiteFile } from "./files";
import type { SharedContract } from "./chromeForm";

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function defaultSharedPath(entityName: string): string {
  return `components/shared/${toPascalCase(entityName)}Card.tsx`;
}

function buildStubTsx(contract: SharedContract, componentName: string): string {
  const fields =
    contract.fields.length > 0 ? contract.fields : ["title", "href", "description"];
  const propsType = fields
    .map((f) => {
      const key = f.replace(/[^a-zA-Z0-9_]/g, "_") || "field";
      return `  ${key}: string;`;
    })
    .join("\n");
  const titleField = fields.find((f) => /title|name|label/i.test(f)) ?? fields[0] ?? "title";
  const hrefField = fields.find((f) => /href|url|link/i.test(f)) ?? "href";
  const safeTitle = titleField.replace(/[^a-zA-Z0-9_]/g, "_") || "title";
  const safeHref = hrefField.replace(/[^a-zA-Z0-9_]/g, "_") || "href";

  return `"use client";

/**
 * Shared contract stub for ${contract.entityName}.
 * Page agents should import this path instead of inventing a parallel card.
${contract.listSlug ? ` * List slug: ${contract.listSlug}` : ""}
${contract.detailRoutePattern ? ` * Detail route: ${contract.detailRoutePattern}` : ""}
 */
export type ${componentName}Props = {
${propsType}
};

export function ${componentName}(props: ${componentName}Props) {
  const title = props.${safeTitle} ?? "${contract.entityName}";
  const href = props.${safeHref} ?? "#";
  return (
    <a
      href={href}
      className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition hover:bg-accent/40"
    >
      <div className="font-medium">{title}</div>
    </a>
  );
}
`;
}

/**
 * Write stub files for each shared contract. Returns relative paths written.
 */
export function writeSharedContractStubs(contracts: SharedContract[]): string[] {
  const written: string[] = [];
  for (const contract of contracts) {
    const path = (contract.sharedComponentPath || defaultSharedPath(contract.entityName)).replace(
      /\\/g,
      "/"
    );
    if (!path.startsWith("components/") || !path.endsWith(".tsx")) continue;
    const base = path.split("/").pop()?.replace(/\.tsx$/, "") || "SharedCard";
    const componentName = toPascalCase(base) || "SharedCard";
    writeSiteFile(path, buildStubTsx(contract, componentName));
    written.push(path);
  }
  return written;
}
