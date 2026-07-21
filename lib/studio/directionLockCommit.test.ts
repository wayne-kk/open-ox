import { describe, expect, it } from "vitest";
import {
  buildDirectionLockGenerationPrompt,
  resolveDirectionLockBrief,
  validateDirectionLockGenerationCommit,
} from "./directionLockCommit";
import type { SiteOutline } from "./siteOutline";

const popMartOutline: SiteOutline = {
  pageSlug: "home",
  pageGoal: "展示泡泡玛特品牌 IP 与潮流文化，建立官方品牌形象。",
  modules: [
    {
      id: "mod_ip_matrix",
      type: "features",
      title: "核心 IP 矩阵",
      intent: "展示 Molly、Dimoo、Skullpanda 等明星 IP。",
    },
  ],
};

describe("validateDirectionLockGenerationCommit", () => {
  it("requires the Studio confirmation path while direction lock is enabled", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "intent_agent",
        hasConfirmedSiteOutline: false,
      })
    ).toMatchObject({ ok: false, code: "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION" });
  });

  it("requires a valid outline from the Studio confirmation path", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "direction_lock_ui",
        hasConfirmedSiteOutline: false,
      })
    ).toMatchObject({ ok: false, code: "CONFIRMED_SITE_OUTLINE_REQUIRED" });
  });

  it("allows the confirmed Studio path and the legacy flag-off path", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "direction_lock_ui",
        hasConfirmedSiteOutline: true,
      })
    ).toEqual({ ok: true });
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: false,
        source: "intent_agent",
        hasConfirmedSiteOutline: false,
      })
    ).toEqual({ ok: true });
  });

  it("keeps the original brief and confirmed outline when the UI submits confirmation copy", () => {
    const prompt = buildDirectionLockGenerationPrompt({
      submittedBrief: "确认，下一步",
      bootstrapUserPrompt: "帮我生成一个介绍泡泡玛特的网站",
      confirmedSiteOutline: popMartOutline,
    });

    expect(prompt).not.toBe("确认，下一步");
    expect(prompt).toContain("帮我生成一个介绍泡泡玛特的网站");
    expect(prompt).toContain("展示泡泡玛特品牌 IP 与潮流文化");
    expect(prompt).toContain("核心 IP 矩阵");
    expect(prompt).toContain("Molly、Dimoo、Skullpanda");
  });

  it("prefers the latest complete brief over the trailing confirmation message", () => {
    expect(
      resolveDirectionLockBrief({
        currentBriefDraft: undefined,
        priorBriefDrafts: [
          "## 目标\n打造泡泡玛特品牌展示页。\n\n## 内容\n展示 Molly、Dimoo 和潮玩文化。",
        ],
        bootstrapUserPrompt: "帮我生成一个介绍泡泡玛特的网站",
      })
    ).toContain("打造泡泡玛特品牌展示页");
  });
});
