import type { ModifyDiff, ModifyRecord } from "@/app/studio/hooks/useBuildStudio";

/** Turns that belong in the compact「变更」timeline (code changes with files). */
export function isCodeChangeTurn(record: ModifyRecord): boolean {
  if (record.isSystemMessage) return false;
  if (!record.diffs?.length) return false;
  if (
    record.intentLabel === "对话" ||
    record.intentLabel === "问答" ||
    record.intentLabel === "规划"
  ) {
    return false;
  }
  return true;
}

export function truncateIntent(instruction: string, max = 72): string {
  const oneLine = instruction.trim().replace(/\s+/g, " ");
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

/** Strip markdown noise from a single headline line. */
export function cleanHeadlineLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^[_*]+|[_*]+$/g, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^["「『]|["」』]$/g, "")
    .trim();
}

/**
 * First line of the LLM completion summary — used on the changes timeline card.
 * Falls back to a cleaned instruction when analysis is missing.
 */
export function extractModifyHeadline(record: ModifyRecord, max = 72): string {
  const analysis = (record.plan?.analysis ?? "").trim();
  if (analysis) {
    for (const raw of analysis.split(/\n+/)) {
      const line = cleanHeadlineLine(raw);
      if (!line) continue;
      if (/^[-*•]/.test(raw.trim())) continue;
      if (/^(已更新|变更|文件|验证)/.test(line) && line.length < 8) continue;
      return truncateIntent(line, max);
    }
  }
  return truncateIntent(humanizeModifyInstruction(record.instruction), max);
}

/** Turn Design Mode system drafts into a short human label when no LLM summary yet. */
export function humanizeModifyInstruction(instruction: string): string {
  const text = instruction.trim();
  if (!text) return "代码修改";

  const isDesignMode =
    /Studio Design Mode/i.test(text) ||
    /Apply the following Studio Design Mode/i.test(text);

  if (isDesignMode) {
    const copyChange = text.match(/copy\/text:\s*`([^`]+)`\s*→\s*`([^`]+)`/);
    if (copyChange) {
      return `将文案「${copyChange[1]}」改为「${copyChange[2]}」`;
    }
    const visible = text.match(/Visible copy:\s*`([^`]+)`/);
    if (visible) {
      return `调整选中文案「${visible[1]}」`;
    }
    const classChange = text.match(/className:\s*`([^`]+)`\s*→\s*`([^`]+)`/);
    if (classChange) {
      return "调整了选中元素的样式 class";
    }
    const element = text.match(/Element:\s*`?([A-Za-z0-9._-]+)`?/);
    if (element) {
      return `Design Mode 调整了 ${element[1]} 元素`;
    }
    return "Design Mode 调整了选中元素";
  }

  return text.replace(/\s+/g, " ");
}

export function formatTouchedFilesLabel(diffs: ModifyDiff[], maxNames = 2): string {
  if (diffs.length === 0) return "0 files";
  const names = diffs.slice(0, maxNames).map((d) => d.file.split("/").pop() || d.file);
  const extra = diffs.length > maxNames ? ` +${diffs.length - maxNames}` : "";
  return `${diffs.length} file${diffs.length === 1 ? "" : "s"} · ${names.join(", ")}${extra}`;
}

export function sumDiffStats(diffs: ModifyDiff[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const d of diffs) {
    additions += d.stats.additions;
    deletions += d.stats.deletions;
  }
  return { additions, deletions };
}

/** One-liner under the Details diff — prefers LLM headline. */
export function formatModifyDetailsSummary(record: ModifyRecord): string {
  const headline = extractModifyHeadline(record, 96);
  const diffs = record.diffs ?? [];
  const { additions, deletions } = sumDiffStats(diffs);
  const files = diffs.length;
  return `${headline} · 更新了 ${files} 个文件（+${additions} / -${deletions}）`;
}

export type ModifyPreviewSlot =
  | { mode: "live"; fromIndex: number | null }
  | { mode: "details"; historyIndex: number; filePath: string };
