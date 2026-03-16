const LAYOUT_SECTION_TYPES = new Set(["navigation", "footer"]);

export function isLayoutSection(type: string): boolean {
  return LAYOUT_SECTION_TYPES.has(type);
}

export { LAYOUT_SECTION_TYPES };
