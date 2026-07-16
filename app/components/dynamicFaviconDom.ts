/** Attribute on the canvas-driven favicon <link> we own. */
export const DYNAMIC_FAVICON_OWNED_ATTR = "data-dynamic-favicon";

/** Disable competing icon links without removing React/Next-owned nodes. */
export const DYNAMIC_FAVICON_DISABLED_MEDIA = "not all";

export function isIconLink(node: Node): node is HTMLLinkElement {
  if (!(node instanceof HTMLLinkElement)) return false;
  const rel = (node.getAttribute("rel") || "").toLowerCase();
  return rel.split(/\s+/).some((token) => token === "icon" || token === "shortcut");
}

/**
 * Prefer our canvas favicon without removing other icon <link>s.
 *
 * Next metadata / React own those nodes. Calling `.remove()` on them races the
 * head reconciler on client navigations and throws:
 *   TypeError: Cannot read properties of null (reading 'removeChild')
 */
export function preferOwnedIconLink(owned: HTMLLinkElement): void {
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="shortcut"]',
  )) {
    if (link === owned) continue;
    if (link.getAttribute("media") !== DYNAMIC_FAVICON_DISABLED_MEDIA) {
      link.setAttribute("media", DYNAMIC_FAVICON_DISABLED_MEDIA);
    }
  }
  // Last applicable icon link wins in most browsers.
  if (owned.isConnected) {
    document.head.appendChild(owned);
  }
}
