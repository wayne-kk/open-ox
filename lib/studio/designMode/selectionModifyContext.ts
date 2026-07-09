import type { DesignModeElementPayload } from "./protocol";

/** Short Modify prefix from a Design Mode selection (no long draft). */
export function formatSelectionModifyContext(selected: DesignModeElementPayload): string {
  const tag = selected.tagName.toLowerCase();
  const lines = [
    "Studio Design Mode selection (apply changes to this element only):",
    `- Element: \`${tag}\``,
  ];

  if (selected.source) {
    lines.push(
      `- Source: \`${selected.source.file}:${selected.source.line}:${selected.source.column}\` (\`${selected.source.tag}\`)`
    );
  } else {
    lines.push("- Source: (no file:line:col on this node - use selector / copy below)");
  }

  if (selected.selectorHint) {
    lines.push(`- Selector hint: \`${selected.selectorHint}\``);
  }

  const preview = (selected.textContent ?? selected.textPreview ?? "").trim();
  if (preview) {
    const clipped = preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
    lines.push(`- Visible copy: \`${clipped}\``);
  }

  const classes = (selected.className || "").trim();
  if (classes) {
    const clipped = classes.length > 160 ? `${classes.slice(0, 157)}...` : classes;
    lines.push(`- className: \`${clipped}\``);
  }

  return lines.join("\n");
}
