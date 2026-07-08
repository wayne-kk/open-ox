/** Stable DOM ↔ source anchors for Design Mode (M2). */

export const OX_ANCHOR_ATTR = "data-ox-id" as const;

const OX_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;

export function isValidOxId(id: string | null | undefined): id is string {
  return typeof id === "string" && OX_ID_PATTERN.test(id);
}

/** Literal patterns emitted in generated TSX for a given ox id. */
export function oxIdSourceLiterals(oxId: string): string[] {
  return [
    `${OX_ANCHOR_ATTR}="${oxId}"`,
    `${OX_ANCHOR_ATTR}='${oxId}'`,
    `${OX_ANCHOR_ATTR}={\`${oxId}\`}`,
    `${OX_ANCHOR_ATTR}={"${oxId}"}`,
    `${OX_ANCHOR_ATTR}={'${oxId}'}`,
  ];
}

export function lineContainsOxId(line: string, oxId: string): boolean {
  return oxIdSourceLiterals(oxId).some((literal) => line.includes(literal));
}

/** Line indices where the anchor attribute appears (0-based). */
export function findOxAnchorLineIndices(content: string, oxId: string): number[] {
  const lines = content.split("\n");
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lineContainsOxId(lines[i]!, oxId)) hits.push(i);
  }
  return hits;
}

export function findUniqueOxAnchorLineIndex(content: string, oxId: string): number | null {
  const hits = findOxAnchorLineIndices(content, oxId);
  if (hits.length === 1) return hits[0]!;
  return null;
}

/** Inclusive line range for the JSX element that owns the anchor attribute. */
export function findAnchorElementLineRange(
  lines: string[],
  anchorLineIndex: number
): { start: number; end: number } {
  let openLineIndex = anchorLineIndex;
  let tag: string | null = null;

  for (let i = anchorLineIndex; i >= Math.max(0, anchorLineIndex - 6); i--) {
    const openMatch = lines[i]!.match(/<([a-zA-Z0-9]+)/);
    if (openMatch) {
      tag = openMatch[1]!;
      openLineIndex = i;
      break;
    }
  }

  if (!tag) {
    tag = "div";
  }

  const openLine = lines[openLineIndex] ?? "";
  if (openLine.includes("/>")) {
    return { start: openLineIndex, end: openLineIndex };
  }

  const closePattern = `</${tag}>`;
  for (let i = anchorLineIndex; i < lines.length; i++) {
    if (lines[i]!.includes(closePattern)) {
      return { start: openLineIndex, end: i };
    }
  }
  return { start: openLineIndex, end: Math.min(lines.length - 1, anchorLineIndex + 12) };
}

/** Scan the anchor element block for className (same JSX element). */
export function findClassNameLineNearAnchor(
  lines: string[],
  anchorLineIndex: number
): number | null {
  const { start, end } = findAnchorElementLineRange(lines, anchorLineIndex);
  for (let i = start; i <= end; i++) {
    if (lines[i]!.includes("className")) return i;
  }
  return null;
}

/** Scan the anchor element block for unique text content. */
export function findTextLineNearAnchor(
  lines: string[],
  anchorLineIndex: number,
  text: string
): number | null {
  if (!text) return null;
  const { start, end } = findAnchorElementLineRange(lines, anchorLineIndex);
  const matches: number[] = [];
  for (let i = start; i <= end; i++) {
    if (lines[i]!.includes(text)) matches.push(i);
  }
  if (matches.length === 1) return matches[0]!;
  return null;
}
