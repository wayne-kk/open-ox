export const CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION = 1;

const REQUIRED_SECTIONS = [
  "Design Philosophy",
  "Visual Contract (agent)",
  "Design Token System",
  "Component Stylings",
  "Layout System",
  "Anti-Generic Enforcement",
  "Effects & Animation",
  "Iconography",
  "Accessibility",
] as const;

const REQUIRED_COLOR_ROLES = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "muted",
  "muted-foreground",
  "destructive",
  "destructive-foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "border",
  "input",
  "ring",
] as const;

const REQUIRED_VISUAL_CONTRACT_SUBSECTIONS = [
  "Color roles",
  "Font roles",
  "Bold Factor",
  "Hero",
  "Surfaces",
] as const;

const REQUIRED_COMPONENT_SUBSECTIONS = ["Buttons", "Cards", "Inputs"] as const;

const FORBIDDEN_PATTERNS = [
  { label: "Tailwind theme() function", pattern: /\btheme\s*\(/i },
  { label: "Tailwind v3 @tailwind directive", pattern: /@tailwind\b/i },
  {
    label: "non-semantic spacing scale token",
    pattern: /--spacing-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\s*:/i,
  },
  { label: "unsupported --font-label role", pattern: /--font-label\s*:/i },
  { label: "forbidden clip-path", pattern: /clip-path\s*:/i },
  { label: "forbidden polygon()", pattern: /\bpolygon\s*\(/i },
] as const;

function hasMarkdownHeading(content: string, level: number, heading: string): boolean {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^#{${level}}\\s+${escapedHeading}(?:\\s|\\(|$)`,
    "im",
  ).test(content);
}

function validHexColorToken(content: string, role: string): string | null {
  const tokenStart = new RegExp(`^\\s*--color-${role}\\s*:`, "i");
  const exactToken = new RegExp(
    `^\\s*--color-${role}\\s*:\\s*(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))\\s*;?\\s*(?:/\\*.*\\*/)?\\s*$`,
    "i",
  );
  const tokenLine = content.split("\n").find((line) => tokenStart.test(line));
  if (!tokenLine) return null;
  return tokenLine.match(exactToken)?.[1]?.toLowerCase() ?? "invalid";
}

export interface DesignSystemContractValidation {
  valid: boolean;
  errors: string[];
}

export function validateDesignSystemContract(
  content: string,
  contractVersion: number,
): DesignSystemContractValidation {
  const errors: string[] = [];
  const normalized = content.trim();

  if (contractVersion !== CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION) {
    errors.push(
      `unsupported contract version ${contractVersion}; expected ${CURRENT_DESIGN_SYSTEM_CONTRACT_VERSION}`,
    );
  }

  if (normalized.length < 500) {
    errors.push("design-system content is too short");
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!normalized.toLowerCase().includes(section.toLowerCase())) {
      errors.push(`missing required section: ${section}`);
    }
  }

  for (const subsection of REQUIRED_VISUAL_CONTRACT_SUBSECTIONS) {
    if (!hasMarkdownHeading(normalized, 3, subsection)) {
      errors.push(`missing Visual Contract subsection: ${subsection}`);
    }
  }

  for (const subsection of REQUIRED_COMPONENT_SUBSECTIONS) {
    if (!hasMarkdownHeading(normalized, 3, subsection)) {
      errors.push(`missing component subsection: ${subsection}`);
    }
  }

  const boldFactor = normalized.match(
    /(?:^|\n)###\s+Bold Factor[^\n]*\n([\s\S]*?)(?=\n#{2,3}\s|$)/i,
  );
  if (!boldFactor || !/^\s*1\.\s+\S/m.test(boldFactor[1])) {
    errors.push("Visual Contract Bold Factor must contain a numbered rule");
  }

  for (const role of REQUIRED_COLOR_ROLES) {
    const value = validHexColorToken(normalized, role);
    if (value === null) {
      errors.push(`missing required color role: --color-${role}`);
    } else if (value === "invalid") {
      errors.push(`color role --color-${role} must have one exact hex value`);
    }
  }

  const background = validHexColorToken(normalized, "background");
  if (background === "#fff" || background === "#ffffff") {
    errors.push("--color-background must not be pure white");
  }

  for (const fontRole of ["display", "header", "body"] as const) {
    const markdownRole = new RegExp(
      `(?:^|\\n)\\s*-\\s*(?:\\*\\*)?${fontRole}(?:\\*\\*)?:`,
      "i",
    );
    const tokenRole = `--font-${fontRole}:`;
    if (!markdownRole.test(normalized) && !normalized.includes(tokenRole)) {
      errors.push(`missing required font role: ${fontRole}`);
    }
  }

  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(normalized)) {
      errors.push(`contains ${forbidden.label}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
