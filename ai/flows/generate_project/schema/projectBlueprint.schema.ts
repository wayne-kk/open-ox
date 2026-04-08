export type BlueprintInputShape = "nested" | "flat" | "single-page" | "unknown";

export function detectBlueprintInputShape(value: unknown): BlueprintInputShape {
  if (!value || typeof value !== "object") return "unknown";
  const v = value as Record<string, unknown>;

  if (v.brief && v.experience && v.site) return "nested";
  if (
    typeof v.projectTitle === "string" &&
    typeof v.projectDescription === "string" &&
    v.designIntent &&
    Array.isArray(v.layoutSections) &&
    Array.isArray(v.pages)
  ) {
    return "flat";
  }
  if (
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    v.designIntent &&
    Array.isArray(v.sections)
  ) {
    return "single-page";
  }
  return "unknown";
}

export function warnOnBlueprintFallback(shape: BlueprintInputShape): void {
  if (shape === "nested") return;
  if (shape === "unknown") {
    console.warn("[blueprint-schema] Unknown input shape; normalize may fail.");
    return;
  }
  console.warn(`[blueprint-schema] Fallback input shape detected: ${shape}`);
}
