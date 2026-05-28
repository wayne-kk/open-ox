const galleryInflight = new Map<string, Promise<Response>>();

/** Dedupe identical gallery list requests (e.g. React Strict Mode double mount in dev). */
export function fetchProjectGalleryDeduped(url: string, init?: RequestInit): Promise<Response> {
  const key = `${init?.method ?? "GET"} ${url}`;
  const existing = galleryInflight.get(key);
  if (existing) return existing;

  const promise = fetch(url, init).finally(() => {
    galleryInflight.delete(key);
  });
  galleryInflight.set(key, promise);
  return promise;
}
