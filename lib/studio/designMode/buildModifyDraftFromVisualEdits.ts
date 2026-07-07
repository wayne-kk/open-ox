import type { DesignModeProperty, VisualEdit } from "./protocol";

const PROPERTY_LABELS: Record<DesignModeProperty, string> = {
  color: "text/foreground color",
  fontSize: "font-size",
  padding: "padding",
  borderRadius: "border-radius",
};

const TAILWIND_HINTS: Record<DesignModeProperty, string> = {
  color: "Prefer Tailwind `text-*` / `bg-*` (or arbitrary `text-[…]` / `bg-[…]`) matching the target value.",
  fontSize: "Prefer Tailwind `text-*` scale or arbitrary `text-[Npx]`.",
  padding: "Prefer Tailwind `p-*` / `px-*` / `py-*` or arbitrary spacing.",
  borderRadius: "Prefer Tailwind `rounded-*` or arbitrary `rounded-[Npx]`.",
};

function formatElementLabel(edit: VisualEdit): string {
  return edit.elementLabel.trim() || edit.selectorHint;
}

/** Group edits by element so the Modify agent sees one block per target. */
function groupEditsByElement(edits: VisualEdit[]): Map<string, VisualEdit[]> {
  const groups = new Map<string, VisualEdit[]>();
  for (const edit of edits) {
    const key = `${edit.selectorHint}::${edit.elementLabel}`;
    const list = groups.get(key) ?? [];
    list.push(edit);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Turn visual edits into a Modify instruction draft.
 * Does not write files — caller must route through `runModifyProject`.
 */
export function buildModifyDraftFromVisualEdits(edits: VisualEdit[]): string {
  if (edits.length === 0) {
    return "";
  }

  const lines: string[] = [
    "Apply the following Studio Design Mode visual tweaks to the project source.",
    "",
    "Constraints:",
    "- Update Tailwind classes or component styles only — do not change layout structure, DOM hierarchy, or add/remove elements.",
    "- Match the requested values as closely as practical in the generated site's styling system.",
    "",
    "Changes:",
  ];

  let index = 1;
  for (const [, group] of groupEditsByElement(edits)) {
    const head = group[0];
    if (!head) continue;
    lines.push(`${index}. Element: ${formatElementLabel(head)}`);
    lines.push(`   Selector hint: \`${head.selectorHint}\``);
    for (const edit of group) {
      const label = PROPERTY_LABELS[edit.property];
      lines.push(`   - ${label}: \`${edit.before}\` → \`${edit.after}\``);
      lines.push(`     (${TAILWIND_HINTS[edit.property]})`);
    }
    lines.push("");
    index += 1;
  }

  return lines.join("\n").trimEnd();
}
