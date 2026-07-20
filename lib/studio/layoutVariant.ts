export const LAYOUT_VARIANT_IDS = ["hero_centered", "hero_split", "hero_editorial"] as const;

export type LayoutVariantId = (typeof LAYOUT_VARIANT_IDS)[number];

export function isLayoutVariantId(value: unknown): value is LayoutVariantId {
  return typeof value === "string" && (LAYOUT_VARIANT_IDS as readonly string[]).includes(value);
}

export function layoutVariantIdForIndex(index: number): LayoutVariantId {
  return LAYOUT_VARIANT_IDS[index % LAYOUT_VARIANT_IDS.length]!;
}

export function layoutVariantHint(id: LayoutVariantId | string | undefined): string {
  switch (id) {
    case "hero_split":
      return "Opening layout preference: split hero (copy left / visual right or reverse), balanced two-column first viewport.";
    case "hero_editorial":
      return "Opening layout preference: editorial hero with generous whitespace, serif-friendly headline hierarchy, asymmetric accents.";
    case "hero_centered":
    default:
      return "Opening layout preference: centered hero with clear headline, supporting line, and dominant CTA.";
  }
}
