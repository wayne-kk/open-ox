/**
 * Compact relative time for gallery / community cards.
 * Uses Intl so locale follows the active UI language.
 */
export function formatRelativeTime(dateStr: string, locale = "zh-CN"): string {
  const parsed = new Date(dateStr).getTime();
  if (!Number.isFinite(parsed)) return "";

  const diffSec = Math.round((parsed - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSec);

  if (abs < 60) return rtf.format(diffSec, "second");
  const mins = Math.round(diffSec / 60);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}
