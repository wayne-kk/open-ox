import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.OPEN_OX_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  const value = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!expected || !value) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
