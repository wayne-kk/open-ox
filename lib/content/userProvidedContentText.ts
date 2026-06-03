import type { UserProvidedContent } from "@/ai/flows/generate_project/types";

export const USER_PROVIDED_CONTENT_PATH = "content/user-provided.md";

/**
 * Plain-text description of user-provided content for downstream Agents.
 * Not structured JSON — Agents read and interpret freely.
 */
export function formatUserProvidedContentAsText(content: UserProvidedContent): string {
  const lines: string[] = ["# User-provided content", ""];

  const b = content.business;
  if (b && Object.values(b).some(Boolean)) {
    lines.push("## Business");
    if (b.name) lines.push(`Name: ${b.name}`);
    if (b.description) lines.push(`Description: ${b.description}`);
    if (b.address) lines.push(`Address: ${b.address}`);
    if (b.phone) lines.push(`Phone: ${b.phone}`);
    if (b.website) lines.push(`Website: ${b.website}`);
    if (b.rating) lines.push(`Rating: ${b.rating}`);
    if (b.reviewCount) lines.push(`Review count: ${b.reviewCount}`);
    lines.push("");
  }

  if (content.hours?.length) {
    lines.push("## Hours");
    for (const line of content.hours) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }

  if (content.menuItems?.length) {
    lines.push("## Menu");
    for (const item of content.menuItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (content.palette?.length) {
    lines.push("## Colors / palette");
    for (const swatch of content.palette) {
      lines.push(`- ${swatch}`);
    }
    lines.push("");
  }

  if (content.images?.length) {
    lines.push(
      "## Images (each URL once as remote src; use generate_image only after all URLs are assigned)"
    );
    content.images.forEach((img, i) => {
      lines.push(`${i + 1}. URL: ${img.url}`);
      if (img.caption) lines.push(`   Caption: ${img.caption}`);
      if (img.role) lines.push(`   Role: ${img.role}`);
    });
    lines.push("");
  }

  if (content.testimonials?.length) {
    lines.push("## Testimonials");
    for (const t of content.testimonials) {
      const meta = [t.author, t.stars != null ? `${t.stars} stars` : "", t.relativeTime]
        .filter(Boolean)
        .join(", ");
      lines.push(`- "${t.quote}"${meta ? ` — ${meta}` : ""}`);
    }
    lines.push("");
  }

  if (content.links?.length) {
    lines.push("## Links");
    for (const link of content.links) {
      lines.push(`- ${link.label ? `${link.label}: ` : ""}${link.url}`);
    }
    lines.push("");
  }

  if (content.notes?.trim()) {
    lines.push("## Notes");
    lines.push(content.notes.trim());
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function writeUserProvidedContentText(
  writeFile: (path: string, content: string) => Promise<void> | void,
  content: UserProvidedContent
): Promise<void> {
  await writeFile(USER_PROVIDED_CONTENT_PATH, formatUserProvidedContentAsText(content));
}
