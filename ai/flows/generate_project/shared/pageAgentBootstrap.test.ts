import { describe, expect, it } from "vitest";
import { runWithSiteRoot } from "@/ai/tools/system/common";
import { getSiteRoot } from "@/lib/projectManager";
import {
  buildPageAgentBootstrap,
  PAGE_AGENT_DESIGN_SYSTEM_BOOTSTRAP_MAX_CHARS,
} from "./pageAgentBootstrap";
import { PAGE_AGENT_DESIGN_SYSTEM_PATH } from "./pageAgentBrief";

describe("pageAgentBootstrap", () => {
  it("injects full design-system.md, not a Visual Contract-only extract", async () => {
    const fullDs = [
      "# Test Design System",
      "",
      "## 1. Design Philosophy",
      "Obsidian canvas with cyan plasma signatures.",
      "",
      "## Visual Contract (agent)",
      "",
      "### Color roles",
      "- `background`: `#020617`",
      "",
      "## Tokens — Colors",
      "--color-background: #020617",
      "",
      "## Visual Signatures That Make This Unforgettable",
      "- **Rim Lighting**: 1px cyan edge glow on cards.",
    ].join("\n");

    await runWithSiteRoot(getSiteRoot("2026-07-17T08-47-38-436Z_project"), async () => {
      const bootstrap = buildPageAgentBootstrap({
        hasUserProvidedContent: false,
        designSystem: fullDs,
      });

      expect(bootstrap.bootstrappedPaths.has(PAGE_AGENT_DESIGN_SYSTEM_PATH)).toBe(true);
      expect(bootstrap.message).toContain(`### \`${PAGE_AGENT_DESIGN_SYSTEM_PATH}\``);
      expect(bootstrap.message).toContain("## 1. Design Philosophy");
      expect(bootstrap.message).toContain("## Tokens — Colors");
      expect(bootstrap.message).toContain("Rim Lighting");
      expect(bootstrap.message).not.toContain("### Visual Contract (from design system)");
      expect(bootstrap.compactSummary).toContain("full design system injected");
      expect(PAGE_AGENT_DESIGN_SYSTEM_BOOTSTRAP_MAX_CHARS).toBeGreaterThanOrEqual(fullDs.length);
    });
  });
});
