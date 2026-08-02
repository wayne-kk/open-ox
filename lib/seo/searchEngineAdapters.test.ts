import { describe, expect, it } from "vitest";

import {
  buildBaiduPushRequest,
  buildIndexNowRequest,
  classifySearchEngineResponse,
  notifySearchEngines,
} from "./searchEngineAdapters";

describe("search engine notification adapters", () => {
  it("builds an IndexNow batch restricted to one configured host", () => {
    expect(
      buildIndexNowRequest(
        ["https://open-ox.tech/showcase/p1/one", "https://open-ox.tech/en/showcase/p1/one"],
        { key: "index-key", siteOrigin: "https://open-ox.tech" }
      )
    ).toMatchObject({
      endpoint: "https://api.indexnow.org/indexnow",
      body: {
        host: "open-ox.tech",
        key: "index-key",
        urlList: [
          "https://open-ox.tech/showcase/p1/one",
          "https://open-ox.tech/en/showcase/p1/one",
        ],
      },
    });
  });

  it("rejects foreign URLs before notifying an engine", () => {
    expect(() =>
      buildIndexNowRequest(["https://attacker.example/page"], {
        key: "index-key",
        siteOrigin: "https://open-ox.tech",
      })
    ).toThrow("SEARCH_URL_OUTSIDE_SITE");
  });

  it("builds a Baidu plain-text URL push", () => {
    const request = buildBaiduPushRequest(["https://open-ox.tech/showcase/p1/one"], {
      site: "https://open-ox.tech",
      token: "secret",
    });
    expect(request.endpoint).toBe(
      "https://data.zz.baidu.com/urls?site=https%3A%2F%2Fopen-ox.tech&token=secret"
    );
    expect(request.body).toBe("https://open-ox.tech/showcase/p1/one");
  });

  it("retries throttling and server failures but not auth failures", () => {
    expect(classifySearchEngineResponse(429)).toBe("retry");
    expect(classifySearchEngineResponse(503)).toBe("retry");
    expect(classifySearchEngineResponse(403)).toBe("dead");
    expect(classifySearchEngineResponse(202)).toBe("success");
  });

  it("submits removed URLs with Baidu's deletion type", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const results = await notifySearchEngines(
      ["https://open-ox.tech/showcase/p1/one"],
      {
        siteOrigin: "https://open-ox.tech",
        indexNowKey: "key",
        baiduSite: "https://open-ox.tech",
        baiduToken: "token",
        baiduRemoval: true,
        fetchImpl,
      }
    );

    expect(calls).toEqual([
      "https://api.indexnow.org/indexnow",
      "https://data.zz.baidu.com/urls?site=https%3A%2F%2Fopen-ox.tech&token=token&type=del",
    ]);
    expect(results).toContainEqual({ engine: "baidu", status: "success", httpStatus: 200 });
  });

  it("treats Baidu application errors in HTTP 200 responses as permanent failures", async () => {
    const results = await notifySearchEngines(
      ["https://open-ox.tech/showcase/p1/one"],
      {
        siteOrigin: "https://open-ox.tech",
        includeIndexNow: false,
        baiduSite: "https://open-ox.tech",
        baiduToken: "invalid",
        fetchImpl: (async () =>
          new Response(JSON.stringify({ error: 401, message: "invalid token" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })) as typeof fetch,
      }
    );

    expect(results).toContainEqual({
      engine: "baidu",
      status: "dead",
      httpStatus: 200,
      error: "invalid token",
    });
  });
});
