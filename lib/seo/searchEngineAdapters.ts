export type SearchEngineDisposition = "success" | "retry" | "dead";

export function classifySearchEngineResponse(status: number): SearchEngineDisposition {
  if (status >= 200 && status < 300) return "success";
  if (status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "dead";
}

function assertSiteUrls(urls: string[], siteOrigin: string): URL[] {
  const origin = new URL(siteOrigin).origin;
  return urls.map((value) => {
    const url = new URL(value);
    if (url.origin !== origin) throw new Error("SEARCH_URL_OUTSIDE_SITE");
    return url;
  });
}

export function buildIndexNowRequest(
  urls: string[],
  config: { key: string; siteOrigin: string; keyLocation?: string }
) {
  const checked = assertSiteUrls(urls, config.siteOrigin);
  const origin = new URL(config.siteOrigin);
  return {
    endpoint: "https://api.indexnow.org/indexnow",
    body: {
      host: origin.host,
      key: config.key,
      keyLocation: config.keyLocation || `${origin.origin}/indexnow-key`,
      urlList: checked.map((url) => url.toString()),
    },
  };
}

export function buildBaiduPushRequest(
  urls: string[],
  config: { site: string; token: string; removal?: boolean }
) {
  const checked = assertSiteUrls(urls, config.site);
  const params = new URLSearchParams({ site: new URL(config.site).origin, token: config.token });
  if (config.removal) params.set("type", "del");
  return {
    endpoint: `https://data.zz.baidu.com/urls?${params.toString()}`,
    body: checked.map((url) => url.toString()).join("\n"),
  };
}

export type AdapterResult = {
  engine: "indexnow" | "baidu";
  status: "success" | "skipped" | "retry" | "dead";
  httpStatus?: number;
  error?: string;
};

export async function notifySearchEngines(
  urls: string[],
  options: {
    siteOrigin: string;
    indexNowKey?: string;
    indexNowKeyLocation?: string;
    includeIndexNow?: boolean;
    baiduSite?: string;
    baiduToken?: string;
    includeBaidu?: boolean;
    baiduRemoval?: boolean;
    fetchImpl?: typeof fetch;
  }
): Promise<AdapterResult[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const results: AdapterResult[] = [];

  if (options.includeIndexNow !== false && options.indexNowKey) {
    try {
      const request = buildIndexNowRequest(urls, {
        key: options.indexNowKey,
        siteOrigin: options.siteOrigin,
        keyLocation: options.indexNowKeyLocation,
      });
      const response = await fetchImpl(request.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(request.body),
      });
      results.push({ engine: "indexnow", status: classifySearchEngineResponse(response.status), httpStatus: response.status });
    } catch (error) {
      results.push({ engine: "indexnow", status: "retry", error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    results.push({ engine: "indexnow", status: "skipped" });
  }

  if (options.includeBaidu !== false && options.baiduSite && options.baiduToken) {
    try {
      const request = buildBaiduPushRequest(urls, {
        site: options.baiduSite,
        token: options.baiduToken,
        removal: options.baiduRemoval,
      });
      const response = await fetchImpl(request.endpoint, {
        method: "POST",
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: request.body,
      });
      let status = classifySearchEngineResponse(response.status);
      let applicationError: string | undefined;
      if (response.ok) {
        const payload = await response.json().catch(() => null) as { error?: number; message?: string } | null;
        if (payload?.error) {
          status = "dead";
          applicationError = payload.message || `Baidu error ${payload.error}`;
        }
      }
      results.push({ engine: "baidu", status, httpStatus: response.status, ...(applicationError ? { error: applicationError } : {}) });
    } catch (error) {
      results.push({ engine: "baidu", status: "retry", error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    results.push({ engine: "baidu", status: "skipped" });
  }

  return results;
}
