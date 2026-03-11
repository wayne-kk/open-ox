/**
 * Skill Registry - 集中管理所有 skills
 */

import { skills } from "../skills";
import type { Skill } from "../types";

export function loadAllSkills(): Map<string, Skill> {
  return skills;
}

export function getSkill(name: string): Skill | undefined {
  return skills.get(name);
}

export function getAllSkillMetadata(): Array<{
  name: string;
  description: string;
  examples: string[];
}> {
  return Array.from(skills.values()).map((s) => ({
    name: s.name,
    description: s.description,
    examples: s.examples,
  }));
}
