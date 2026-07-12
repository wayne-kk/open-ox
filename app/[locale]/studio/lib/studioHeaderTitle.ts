/**
 * Studio top-bar crumb after "STUDIO /".
 * Prefer the project display name (DB `name` / blueprint title), never the raw user prompt.
 */
export function resolveStudioHeaderTitle(opts: {
  projectName: string | null | undefined;
  projectId: string;
  maxChars?: number;
}): string {
  const maxChars = opts.maxChars ?? 40;
  const name = opts.projectName?.trim();
  if (name) {
    return name.length > maxChars ? `${name.slice(0, maxChars)}…` : name;
  }
  const id = opts.projectId.trim();
  if (!id) return "未命名项目";
  return id.length > 32 ? `${id.slice(0, 32)}…` : id;
}
