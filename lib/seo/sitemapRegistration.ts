import { createSign } from "node:crypto";

import { getSiteOrigin } from "./siteUrl";

type RegistrationResult = {
  engine: "google" | "bing";
  status: "success" | "skipped" | "failed";
  httpStatus?: number;
  error?: string;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function googleServiceAccountToken(config: { email: string; privateKey: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: config.email,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `Google OAuth HTTP ${response.status}`);
  }
  return payload.access_token;
}

export async function registerSitemapWithSearchEngines(): Promise<RegistrationResult[]> {
  const origin = getSiteOrigin();
  const sitemap = `${origin}/sitemap.xml`;
  const results: RegistrationResult[] = [];

  const googleEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL?.trim();
  const googlePrivateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?.replaceAll("\\n", "\n").trim();
  const googleSite = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || origin;
  if (googleEmail && googlePrivateKey) {
    try {
      const token = await googleServiceAccountToken({ email: googleEmail, privateKey: googlePrivateKey });
      const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(googleSite)}/sitemaps/${encodeURIComponent(sitemap)}`;
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}` },
      });
      results.push({ engine: "google", status: response.ok ? "success" : "failed", httpStatus: response.status });
    } catch (error) {
      results.push({ engine: "google", status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    results.push({ engine: "google", status: "skipped", error: "Google Search Console credentials not configured" });
  }

  const bingKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (bingKey) {
    try {
      const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitSiteMap?apikey=${encodeURIComponent(bingKey)}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ siteUrl: origin, siteMap: sitemap }),
      });
      results.push({ engine: "bing", status: response.ok ? "success" : "failed", httpStatus: response.status });
    } catch (error) {
      results.push({ engine: "bing", status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    results.push({ engine: "bing", status: "skipped", error: "Bing Webmaster API key not configured" });
  }

  return results;
}
