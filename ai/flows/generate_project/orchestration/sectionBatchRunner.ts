import type { PlannedSectionSpec } from "../types";

export interface SectionBatchItem {
  scopeKey: string;
  section: PlannedSectionSpec;
  outputFileRelative: string;
}

export function groupSectionsByScope(items: SectionBatchItem[]): Record<string, SectionBatchItem[]> {
  return items.reduce<Record<string, SectionBatchItem[]>>((acc, item) => {
    acc[item.scopeKey] ??= [];
    acc[item.scopeKey].push(item);
    return acc;
  }, {});
}
