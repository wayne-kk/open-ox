const galleryInflight = new Map<string, Promise<Response>>();

/**
 * Dedupe identical gallery list requests (e.g. React Strict Mode double mount,
 * or remount while a prior navigation's request is still in flight).
 * Each caller gets a cloned Response so concurrent `res.json()` reads are safe.
 */
export function fetchProjectGalleryDeduped(url: string, init?: RequestInit): Promise<Response> {
  const key = `${init?.method ?? "GET"} ${url}`;
  let shared = galleryInflight.get(key);
  if (!shared) {
    shared = fetch(url, init).finally(() => {
      galleryInflight.delete(key);
    });
    galleryInflight.set(key, shared);
  }
  return shared.then((res) => res.clone());
}
