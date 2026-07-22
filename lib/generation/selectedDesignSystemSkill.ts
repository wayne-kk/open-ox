export interface SelectedDesignSystemSkill {
  id: string;
  version: string;
}

export function parseSelectedDesignSystemSkill(
  value: unknown,
): SelectedDesignSystemSkill | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id.trim() ||
    typeof record.version !== "string" ||
    !record.version.trim()
  ) {
    return undefined;
  }
  return {
    id: record.id.trim(),
    version: record.version.trim(),
  };
}
