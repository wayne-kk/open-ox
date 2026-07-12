import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchVercelTeam,
  listAccessibleVercelTeams,
  listVercelTeams,
} from "./oauth";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listAccessibleVercelTeams", () => {
  it("prefers get-by-id for integration install team (avoids list-all 403)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v2/teams/team_abc")) {
        return jsonResponse(200, { id: "team_abc", name: "Open OX", slug: "open-ox" });
      }
      if (url.endsWith("/v2/teams")) {
        return jsonResponse(403, { error: { message: "Not authorized" } });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const teams = await listAccessibleVercelTeams({
      accessToken: "tok",
      teamId: "team_abc",
      teamName: "stale",
    });

    expect(teams).toEqual([{ id: "team_abc", name: "Open OX", slug: "open-ox" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/teams/team_abc");
  });

  it("falls back to stored metadata when both APIs fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(403, { error: { message: "Not authorized" } }))
    );

    const teams = await listAccessibleVercelTeams({
      accessToken: "tok",
      teamId: "team_abc",
      teamName: "Open OX",
    });

    expect(teams).toEqual([{ id: "team_abc", name: "Open OX", slug: undefined }]);
  });

  it("lists all teams when no install teamId (personal token path)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("https://api.vercel.com/v2/teams");
        return jsonResponse(200, {
          teams: [{ id: "team_1", name: "A", slug: "a" }],
        });
      })
    );

    const teams = await listAccessibleVercelTeams({
      accessToken: "tok",
      teamId: null,
    });
    expect(teams).toEqual([{ id: "team_1", name: "A", slug: "a" }]);
  });
});

describe("listVercelTeams / fetchVercelTeam errors", () => {
  it("surfaces vercel error body on list failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(403, { error: { message: "Not authorized" } }))
    );
    await expect(listVercelTeams("tok")).rejects.toThrow(/Not authorized/);
  });

  it("fetches a single team", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { id: "team_x", name: "X", slug: "x" })
      )
    );
    await expect(fetchVercelTeam("tok", "team_x")).resolves.toEqual({
      id: "team_x",
      name: "X",
      slug: "x",
    });
  });
});
