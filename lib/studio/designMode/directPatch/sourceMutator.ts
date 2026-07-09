import type { DesignModeProperty } from "../protocol";

function parsePxNumber(value: string): number {
  const match = value.match(/([\d.]+)/);
  if (!match) return 0;
  const n = Number.parseFloat(match[1]!);
  return Number.isFinite(n) ? n : 0;
}

function rgbToHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return trimmed;
  const toHex = (n: string) => Number.parseInt(n, 10).toString(16).padStart(2, "0");
  return `#${toHex(rgb[1]!)}${toHex(rgb[2]!)}${toHex(rgb[3]!)}`;
}

function propertyPrefixes(property: DesignModeProperty): string[] {
  switch (property) {
    case "color":
      return ["text-[", "text-"];
    case "fontSize":
      return ["text-[", "text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl", "text-8xl", "text-9xl"];
    case "padding":
      return ["p-[", "p-", "px-", "py-", "pt-", "pb-", "pl-", "pr-"];
    case "borderRadius":
      return ["rounded-[", "rounded-"];
    default:
      return [];
  }
}

/** Map a Design Mode style value to the Tailwind utility written on Apply. */
export function propertyToUtility(property: DesignModeProperty, value: string): string {
  switch (property) {
    case "color":
      return `text-[${rgbToHex(value)}]`;
    case "fontSize":
      return `text-[${parsePxNumber(value)}px]`;
    case "padding":
      return `p-[${parsePxNumber(value)}px]`;
    case "borderRadius":
      return `rounded-[${parsePxNumber(value)}px]`;
    default:
      return value;
  }
}

function isTailwindTextSizeToken(token: string): boolean {
  if (/^text-\[[\d.]+px\]$/.test(token)) return true;
  return /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(token);
}

function tokenConflicts(token: string, property: DesignModeProperty): boolean {
  switch (property) {
    case "color":
      if (token.startsWith("text-[") && !/^text-\[[\d.]+px\]$/.test(token)) return true;
      if (token.startsWith("text-") && !isTailwindTextSizeToken(token)) return true;
      return false;
    case "fontSize":
      return isTailwindTextSizeToken(token);
    case "padding":
      return propertyPrefixes("padding").some((prefix) => token.startsWith(prefix));
    case "borderRadius":
      return propertyPrefixes("borderRadius").some((prefix) => token.startsWith(prefix));
    default:
      return false;
  }
}

/** Replace or append a Tailwind utility in a class string. */
export function upsertTailwindUtility(classNames: string, property: DesignModeProperty, value: string): string {
  const utility = propertyToUtility(property, value);
  const tokens = classNames.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((token) => !tokenConflicts(token, property));
  kept.push(utility);
  return kept.join(" ");
}

const CLASSNAME_PATTERNS = [
  /className\s*=\s*"([^"]+)"/,
  /className\s*=\s*'([^']+)'/,
  /className\s*=\s*\{`([^`]+)`\}/,
];

/** Mutate the first className literal on a source line. */
export function patchClassNameOnLine(
  line: string,
  mutator: (classes: string) => string
): { oldLine: string; newLine: string } | null {
  for (const pattern of CLASSNAME_PATTERNS) {
    const match = line.match(pattern);
    if (!match?.[1]) continue;
    const oldClasses = match[1];
    const newClasses = mutator(oldClasses);
    if (newClasses === oldClasses) continue;
    const newLine = line.replace(match[0], match[0].replace(oldClasses, newClasses));
    return { oldLine: line, newLine };
  }
  return null;
}

/** Replace JSX text on a single line when unique within the file. */
export function patchTextInFile(
  content: string,
  before: string,
  after: string
): { old_string: string; new_string: string } | { error: string } {
  if (!before) return { error: "Missing text before value" };
  const occurrences = content.split(before).length - 1;
  if (occurrences === 0) return { error: `Text "${before}" not found in file` };
  if (occurrences > 1) return { error: `Text "${before}" appears ${occurrences} times — cannot patch safely` };
  return {
    old_string: before,
    new_string: after,
  };
}
