import { describe, expect, it } from "vitest";

import { RECENT_PROJECTS_CHANGED_EVENT, RECENT_PROJECTS_LIMIT } from "./recentProjects";

describe("recentProjects", () => {
  it("caps sidebar recent list at 10", () => {
    expect(RECENT_PROJECTS_LIMIT).toBe(10);
  });

  it("uses a stable change event name", () => {
    expect(RECENT_PROJECTS_CHANGED_EVENT).toBe("open-ox:recent-projects-changed");
  });
});
