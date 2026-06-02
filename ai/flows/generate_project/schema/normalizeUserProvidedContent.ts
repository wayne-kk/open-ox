import type {
  UserProvidedBusiness,
  UserProvidedContent,
  UserProvidedImage,
  UserProvidedLink,
  UserProvidedTestimonial,
} from "../types";

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function normalizeBusiness(value: unknown): UserProvidedBusiness | undefined {
  if (!value || typeof value !== "object") return undefined;
  const c = value as Partial<UserProvidedBusiness>;
  const business: UserProvidedBusiness = {
    name: trimOrUndefined(c.name),
    description: trimOrUndefined(c.description),
    address: trimOrUndefined(c.address),
    phone: trimOrUndefined(c.phone),
    website: trimOrUndefined(c.website),
    rating: trimOrUndefined(c.rating),
    reviewCount: trimOrUndefined(c.reviewCount),
  };
  return Object.values(business).some(Boolean) ? business : undefined;
}

function normalizeTestimonials(value: unknown): UserProvidedTestimonial[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: UserProvidedTestimonial[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<UserProvidedTestimonial>;
    const quote = trimOrUndefined(c.quote);
    if (!quote) continue;
    items.push({
      quote,
      author: trimOrUndefined(c.author),
      stars:
        typeof c.stars === "number" || typeof c.stars === "string" ? c.stars : undefined,
      relativeTime: trimOrUndefined(c.relativeTime),
    });
  }
  return items.length > 0 ? items : undefined;
}

function normalizeImages(value: unknown): UserProvidedImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: UserProvidedImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<UserProvidedImage>;
    const url = trimOrUndefined(c.url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    items.push({
      url,
      caption: trimOrUndefined(c.caption),
      role: trimOrUndefined(c.role),
      localPath: trimOrUndefined(c.localPath),
      assetSource:
        c.assetSource === "download" || c.assetSource === "generated"
          ? c.assetSource
          : undefined,
    });
  }
  return items.length > 0 ? items : undefined;
}

function normalizeLinks(value: unknown): UserProvidedLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: UserProvidedLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<UserProvidedLink>;
    const url = trimOrUndefined(c.url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    items.push({
      url,
      label: trimOrUndefined(c.label),
    });
  }
  return items.length > 0 ? items : undefined;
}

/** Returns undefined when the object carries no usable user-provided content. */
export function normalizeUserProvidedContent(value: unknown): UserProvidedContent | undefined {
  if (!value || typeof value !== "object") return undefined;

  const c = value as Partial<UserProvidedContent>;
  const content: UserProvidedContent = {
    business: normalizeBusiness(c.business),
    hours: normalizeStringList(c.hours),
    palette: normalizeStringList(c.palette),
    menuItems: normalizeStringList(c.menuItems),
    testimonials: normalizeTestimonials(c.testimonials),
    images: normalizeImages(c.images),
    links: normalizeLinks(c.links),
    notes: trimOrUndefined(c.notes),
  };

  const hasContent =
    Boolean(content.business) ||
    Boolean(content.hours?.length) ||
    Boolean(content.palette?.length) ||
    Boolean(content.menuItems?.length) ||
    Boolean(content.testimonials?.length) ||
    Boolean(content.images?.length) ||
    Boolean(content.links?.length) ||
    Boolean(content.notes);

  return hasContent ? content : undefined;
}

export function hasUserProvidedContent(content: UserProvidedContent | undefined): boolean {
  return normalizeUserProvidedContent(content) !== undefined;
}
