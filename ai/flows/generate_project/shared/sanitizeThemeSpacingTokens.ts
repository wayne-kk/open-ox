/** Tailwind v4 scale keys that hijack max-w-*, p-*, gap-*, etc. when defined as --spacing-* in @theme. */
const COLLIDING_SPACING_KEY =
  /^(\s*)--spacing-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)(\s*:)/gm;

/**
 * Rename design-system spacing tokens that collide with Tailwind's built-in scale.
 * e.g. `--spacing-xl: 32px` → `--spacing-gap-xl: 32px` so `max-w-xl` stays 36rem.
 */
export function sanitizeThemeSpacingTokens(globalsCss: string): string {
  return globalsCss.replace(
    COLLIDING_SPACING_KEY,
    "$1--spacing-gap-$2$3",
  );
}
