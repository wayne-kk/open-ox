export function getInternalEmailDomains(): string[] {
  const raw = process.env.ANALYTICS_INTERNAL_EMAIL_DOMAINS ?? "";
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return getInternalEmailDomains().includes(domain);
}

export function isInternalUser(params: {
  userId: string;
  email: string | null | undefined;
  adminUserIds: ReadonlySet<string>;
  manualInternalIds: ReadonlySet<string>;
}): boolean {
  if (params.adminUserIds.has(params.userId)) return true;
  if (params.manualInternalIds.has(params.userId)) return true;
  return isInternalEmail(params.email);
}

export function filterExternalUsers<T extends { id: string; email: string | null | undefined }>(
  users: T[],
  context: {
    adminUserIds: ReadonlySet<string>;
    manualInternalIds: ReadonlySet<string>;
  }
): T[] {
  return users.filter(
    (user) =>
      !isInternalUser({
        userId: user.id,
        email: user.email,
        adminUserIds: context.adminUserIds,
        manualInternalIds: context.manualInternalIds,
      })
  );
}
