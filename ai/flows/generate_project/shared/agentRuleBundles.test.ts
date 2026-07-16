import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  PAGE_IMPLEMENT_AGENT_RULE_BODIES_MAX_CHARS,
  PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE,
  PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE_MAX_LENGTH,
  resolvePageImplementAgentRuleIds,
} from "./agentRuleBundles";

const RULES_DIR = join(
  process.cwd(),
  "ai/flows/generate_project/prompts/rules"
);

describe("PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE freeze", () => {
  it("stays within the frozen max length (no silent append sprawl)", () => {
    expect(PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE.length).toBeLessThanOrEqual(
      PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE_MAX_LENGTH
    );
  });

  it("composed base rule bodies stay under freeze ceiling (excludes bootstrap)", () => {
    let total = 0;
    for (const id of PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE) {
      const path = join(RULES_DIR, `${id}.md`);
      expect(existsSync(path), `missing rule file: ${id}`).toBe(true);
      total += readFileSync(path, "utf8").length;
    }
    // Soft budget for Page system rule stack (frontend + step prompts are separate).
    expect(total).toBeLessThanOrEqual(PAGE_IMPLEMENT_AGENT_RULE_BODIES_MAX_CHARS);
  });

  it("resolvePageImplementAgentRuleIds includes every base id", () => {
    const resolved = resolvePageImplementAgentRuleIds();
    for (const id of PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE) {
      expect(resolved).toContain(id);
    }
  });
});
