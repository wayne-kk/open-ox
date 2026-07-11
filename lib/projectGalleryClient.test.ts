import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProjectGalleryDeduped } from "./projectGalleryClient";

describe("fetchProjectGalleryDeduped", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets concurrent callers each read JSON (Strict Mode / remount race)", async () => {
    const payload = { projects: [{ id: "p1", name: "Demo" }] };
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = "/api/projects/gallery?offset=0&limit=10&mine=1&folder=all";

    // Mirrors dashboard loadInitialProjects under React Strict Mode:
    // two overlapping callers share one inflight request and both call res.json().
    const [a, b] = await Promise.all([
      fetchProjectGalleryDeduped(url).then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as typeof payload;
      }),
      fetchProjectGalleryDeduped(url).then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as typeof payload;
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a?.projects).toEqual(payload.projects);
    expect(b?.projects).toEqual(payload.projects);
  });
});
