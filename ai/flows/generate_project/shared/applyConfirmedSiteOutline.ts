import type { ProjectBlueprint } from "../types";
import { outlineToSectionSpecs, type SiteOutline } from "@/lib/studio/siteOutline";

/**
 * Seed home page sections from a user-confirmed SiteOutline.
 * Preserves other page fields; forces slug `home`.
 */
export function applyConfirmedSiteOutlineToBlueprint<T extends ProjectBlueprint>(
  blueprint: T,
  outline: SiteOutline
): T {
  const sections = outlineToSectionSpecs(outline);
  const pages = blueprint.site.pages.length > 0 ? [...blueprint.site.pages] : [];
  const homeIdx = pages.findIndex((p) => p.slug === "home");
  const homeBase =
    homeIdx >= 0
      ? pages[homeIdx]!
      : {
          title: "Home",
          slug: "home",
          description: outline.pageGoal,
          journeyStage: "entry",
          primaryRoleIds: ["visitor"],
          supportingCapabilityIds: [] as string[],
          sections: [],
        };

  const home = {
    ...homeBase,
    slug: "home" as const,
    description: homeBase.description?.trim() || outline.pageGoal,
    sections,
  };

  if (homeIdx >= 0) {
    pages[homeIdx] = home;
  } else if (pages.length === 0) {
    pages.push(home);
  } else {
    pages[0] = home;
  }

  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      pages,
    },
  };
}
