/**
 * SSRF guard: only navigable origins for automated preview screenshots.
 */
export function previewUrlAllowedForScreenshot(urlString: string): URL {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error("Invalid preview URL");
  }

  const protocol = u.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Preview URL scheme not allowed");
  }

  const host = u.hostname.toLowerCase();

  if (protocol === "https:") {
    if (host.endsWith(".e2b.app") || host.endsWith(".e2b.dev")) {
      return u;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (supabaseUrl) {
      try {
        const supaHost = new URL(supabaseUrl).hostname.toLowerCase();
        if (supaHost && host === supaHost) {
          return u;
        }
      } catch {
        /* ignore */
      }
    }
    const siteUrlHttps = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrlHttps) {
      try {
        const siteHost = new URL(siteUrlHttps).hostname.toLowerCase();
        if (siteHost && host === siteHost) {
          return u;
        }
      } catch {
        /* ignore */
      }
    }
    const previewOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN?.trim();
    if (previewOrigin) {
      try {
        const previewHost = new URL(previewOrigin).hostname.toLowerCase();
        if (previewHost && host === previewHost) {
          return u;
        }
      } catch {
        /* ignore */
      }
    }
    const suffix = process.env.OPEN_OX_COVER_ALLOWED_HOST_SUFFIX?.trim().toLowerCase();
    if (suffix && host.endsWith(suffix)) {
      return u;
    }
  }

  if (protocol === "http:") {
    if (host === "127.0.0.1" || host === "localhost" || host.endsWith(".localhost")) {
      return u;
    }
    const previewOriginHttp = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN?.trim();
    if (previewOriginHttp) {
      try {
        const previewHost = new URL(previewOriginHttp).hostname.toLowerCase();
        if (previewHost && host === previewHost) {
          return u;
        }
      } catch {
        /* ignore */
      }
    }
    const rawPublic = process.env.OPEN_OX_PREVIEW_PUBLIC_HOST?.trim();
    if (rawPublic) {
      const publicHost = rawPublic.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
      if (publicHost && host === publicHost) {
        return u;
      }
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) {
      try {
        const h = new URL(siteUrl).hostname.toLowerCase();
        if (h && host === h && h !== "localhost" && h !== "127.0.0.1") {
          return u;
        }
      } catch {
        /* ignore */
      }
    }
  }

  throw new Error(`Preview host rejected for screenshots: ${host}`);
}
