import type {
  DesignSystemContractValidation,
} from "./validator";
import {
  findForbiddenDesignSystemConstructs,
  validateDesignSystemContract,
  validateDesignSystemReferenceContract,
} from "./validator";
import type {
  DesignSystemSkill,
  DesignSystemSkillContentFormat,
  DesignSystemSkillMetadata,
} from "./types";

interface DesignSystemSkillContentAdapter {
  extract(raw: string, skillId: string): string;
  validate(
    content: string,
    contractVersion: number,
  ): DesignSystemContractValidation;
}

function extractReferenceContent(raw: string, skillId: string): string {
  if ((raw.match(/<design-system>/gi) ?? []).length !== 1) {
    throw new Error(
      `reference skill "${skillId}" must contain one <design-system> wrapper`,
    );
  }
  const match = raw.match(
    /<design-system>\s*([\s\S]*?)\s*<\/design-system>/i,
  );
  if (!match?.[1]) {
    throw new Error(
      `reference skill "${skillId}" must contain one <design-system> wrapper`,
    );
  }
  const withoutWrapper = match[1].trim();
  if (/<\/?role>|<\/?design-system>/i.test(withoutWrapper)) {
    throw new Error(
      `reference skill "${skillId}" contains nested agent wrappers`,
    );
  }
  const sourceValidation = validateDesignSystemReferenceContract(withoutWrapper);
  if (!sourceValidation.valid) {
    throw new Error(
      `reference skill "${skillId}" is invalid: ${sourceValidation.errors.join(" | ")}`,
    );
  }
  return buildContractArtifact(withoutWrapper);
}

function sanitizeReference(content: string): string {
  return content
    .split("\n")
    .filter((line) => findForbiddenDesignSystemConstructs(line).length === 0)
    .join("\n")
    .trim();
}

function expandHex(value: string): string {
  const hex = value.toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.slice(0, 7);
}

function allHexColors(content: string): string[] {
  return [
    ...new Set(
      [...content.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi)].map(
        (match) => expandHex(match[0]),
      ),
    ),
  ];
}

function findNamedColor(content: string, names: string[]): string | null {
  const normalizedLines = content.split("\n").map((line) =>
    line
      .replace(/[*`_]/g, "")
      .trim()
      .toLowerCase(),
  );
  for (const name of names) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const label = new RegExp(
      `^(?:(?:[-+]|\\d+\\.)\\s*)?(?:\\|\\s*)?${escapedName}(?:\\s*\\([^)]*\\))?\\s*(?::|\\|)`,
      "i",
    );
    for (const line of normalizedLines) {
      if (!label.test(line)) continue;
      const match = line.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i);
      if (match) return expandHex(match[0]);
    }
  }
  return null;
}

function contrastingText(background: string): string {
  const red = Number.parseInt(background.slice(1, 3), 16);
  const green = Number.parseInt(background.slice(3, 5), 16);
  const blue = Number.parseInt(background.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150
    ? "#171717"
    : "#fafafa";
}

function extractReferencePalette(content: string) {
  const colors = allHexColors(content);
  const fallback = (index: number, value: string) => colors[index] ?? value;
  const rawBackground =
    findNamedColor(content, [
      "background-base",
      "background (canvas)",
      "background (surface)",
      "background (the void)",
      "canvas",
      "background",
    ]) ??
    fallback(0, "#f5f5f4");
  const background =
    rawBackground === "#ffffff" ? "#fdfdfc" : rawBackground;
  const foreground =
    findNamedColor(content, [
      "text (primary)",
      "text primary",
      "text main",
      "foreground (on surface)",
      "foreground (ink)",
      "foreground (chrome text)",
      "foreground",
    ]) ?? fallback(1, contrastingText(background));
  const explicitAccent =
    findNamedColor(content, [
      "accent",
      "primary accent",
      "accent (hot red)",
      "accent (magenta)",
      "primary accent (hot magenta)",
      "primary/accent",
    ]);
  const explicitPrimary = findNamedColor(content, [
    "primary/accent",
    "primary accent",
    "primary-red",
    "primary",
  ]);
  const primary =
    explicitPrimary ?? explicitAccent ?? fallback(2, foreground);
  const accent = explicitAccent ?? primary;
  const secondary =
    findNamedColor(content, ["secondary", "secondary accent"]) ??
    fallback(3, primary);
  const muted =
    findNamedColor(content, ["muted", "backgroundalt", "muted (secondary)"]) ??
    fallback(5, background);
  const card =
    findNamedColor(content, [
      "card",
      "card background",
      "surface",
      "foreground (surface)",
    ]) ??
    muted;
  const border =
    findNamedColor(content, ["border", "border base"]) ??
    fallback(6, foreground);

  return {
    background,
    foreground,
    primary,
    primaryForeground: contrastingText(primary),
    secondary,
    secondaryForeground: contrastingText(secondary),
    accent,
    accentForeground: contrastingText(accent),
    muted,
    mutedForeground: foreground,
    destructive: "#b42318",
    destructiveForeground: "#fff7ed",
    card,
    cardForeground: foreground,
    popover: card,
    popoverForeground: foreground,
    border,
    input: muted,
    ring: primary,
  };
}

function buildContractArtifact(reference: string): string {
  const sanitizedReference = sanitizeReference(reference);
  const title = sanitizedReference.match(/^#\s+.+$/m)?.[0] ?? "# Design System";
  const palette = extractReferencePalette(sanitizedReference);

  return `${title}

## 1. Design Philosophy

Apply the selected reference as the authoritative visual direction while preserving the project brief, accessibility, and engineering constraints.

## Visual Contract (agent)

### Color roles

- background: ${palette.background}
- foreground: ${palette.foreground}
- primary: ${palette.primary}
- muted: ${palette.muted}
- accent: ${palette.accent}
- card: ${palette.card}

### Font roles

- display: Follow the full reference typography specification
- header: Follow the full reference typography specification
- body: Follow the full reference typography specification

### Bold Factor (max 5)

1. Implement the selected reference's signature visual devices in the first viewport and at least one supporting section.

### Hero

Use the composition, typography, media treatment, and hierarchy defined by the full reference below.

### Surfaces

Use the selected reference palette and depth language; do not fall back to generic SaaS cards.

## 2. Design Token System (The DNA)

\`\`\`text
--color-background: ${palette.background}
--color-foreground: ${palette.foreground}
--color-primary: ${palette.primary}
--color-primary-foreground: ${palette.primaryForeground}
--color-secondary: ${palette.secondary}
--color-secondary-foreground: ${palette.secondaryForeground}
--color-accent: ${palette.accent}
--color-accent-foreground: ${palette.accentForeground}
--color-muted: ${palette.muted}
--color-muted-foreground: ${palette.mutedForeground}
--color-destructive: ${palette.destructive}
--color-destructive-foreground: ${palette.destructiveForeground}
--color-card: ${palette.card}
--color-card-foreground: ${palette.cardForeground}
--color-popover: ${palette.popover}
--color-popover-foreground: ${palette.popoverForeground}
--color-border: ${palette.border}
--color-input: ${palette.input}
--color-ring: ${palette.ring}
\`\`\`

## 3. Component Stylings

### Buttons

Follow the full reference's button geometry, hierarchy, interaction, and focus treatment using the canonical tokens above.

### Cards

Follow the full reference's surface, border, radius, shadow, and spacing treatment using the canonical tokens above.

### Inputs

Follow the full reference's form-control treatment with explicit padding and visible keyboard focus.

## 4. Layout System

Follow the full reference layout and responsive rhythm while preserving usable content order.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Preserve the reference's named visual signatures instead of replacing them with generic card grids.

## 6. Effects & Animation

Follow the reference motion personality, keep interaction functional, and respect reduced-motion preferences.

## 7. Iconography

Use lucide-react with sizing, stroke, and containers adapted to the selected reference.

## 8. Accessibility

Maintain WCAG AA contrast, visible focus, semantic structure, keyboard access, and reduced-motion alternatives.

## 9. Full Skill Reference

${sanitizedReference}`;
}

const CONTENT_ADAPTERS: Record<
  DesignSystemSkillContentFormat,
  DesignSystemSkillContentAdapter
> = {
  "open-ox-v1": {
    extract: (raw) => raw.trim(),
    validate: validateDesignSystemContract,
  },
  "reference-v1": {
    extract: extractReferenceContent,
    validate: validateDesignSystemContract,
  },
};

export function loadDesignSystemSkillContent(
  raw: string,
  metadata: DesignSystemSkillMetadata,
): string {
  return CONTENT_ADAPTERS[metadata.contentFormat].extract(raw, metadata.id);
}

export function validateDesignSystemSkill(
  skill: DesignSystemSkill,
): DesignSystemContractValidation {
  return CONTENT_ADAPTERS[skill.metadata.contentFormat].validate(
    skill.content,
    skill.metadata.contractVersion,
  );
}
