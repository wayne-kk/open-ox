/**
 * Skill Index - 集中导出所有 skills
 * 新增 skill 时在此添加 import 和 entries
 */

import type { Skill } from "../types";
import { skill as summarizeSkill } from "./summarize/skill";
import { skill as translateSkill } from "./translate/skill";
import { skill as rewriteSkill } from "./rewrite/skill";
import { skill as codeGenerateSkill } from "./code_generate/skill";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SKILLS_BASE = join(process.cwd(), "ai", "skills");

function loadPrompt(skillName: string, version?: string): string {
  try {
    const v2 = join(SKILLS_BASE, skillName, "prompt.v2.md");
    const v1 = join(SKILLS_BASE, skillName, "prompt.md");
    const path = version === "v2" && existsSync(v2) ? v2 : v1;
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

const skillList: [string, Skill][] = [
  [
    "summarize",
    {
      ...summarizeSkill,
      promptContent: loadPrompt("summarize", summarizeSkill.promptVersion),
    },
  ],
  [
    "translate",
    {
      ...translateSkill,
      promptContent: loadPrompt("translate", translateSkill.promptVersion),
    },
  ],
  [
    "rewrite",
    {
      ...rewriteSkill,
      promptContent: loadPrompt("rewrite", rewriteSkill.promptVersion),
    },
  ],
  [
    "code_generate",
    {
      ...codeGenerateSkill,
      promptContent: loadPrompt("code_generate", codeGenerateSkill.promptVersion),
    },
  ],
];

export const skills = new Map<string, Skill>(skillList);
