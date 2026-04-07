/**
 * Generic skill discovery — 任何 agent 均可调用
 *
 * 扫描指定目录下的 .md 文件，解析 YAML frontmatter，返回可用的 skill metadata。
 * 不依赖具体 flow，不读取 prompt 正文。
 *
 * rootPath 由调用方传入，例如：
 *   - generate_project flow: ai/flows/generate_project/prompts/skills/
 *   - 未来其他 agent: ai/skills/<agent-name>/
 * ai/skills/ 目录本身是空的，skill 文件由各 flow 自行管理。
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

const NOTES_MAX_LENGTH = 80;

export interface SkillWhenCondition {
  designKeywords?: { any: string[]; none: string[] };
  traits?: { any: string[]; none: string[] };
  journeyStages?: { any: string[]; none: string[] };
  productTypes?: { any: string[]; none: string[] };
}

export interface SkillMetadata {
  id: string;
  kind?: string;
  sectionTypes: string[];
  priority: number;
  fallback: boolean;
  when?: SkillWhenCondition;
  notes: string;
}

/**
 * 从 frontmatter 解析出 SkillMetadata，兼容缺失字段
 */
function parseSkillMetadata(raw: Record<string, unknown>, id: string): SkillMetadata {
  const when = raw.when as SkillWhenCondition | undefined;
  let notes = raw.notes as string | undefined;
  if (typeof notes === "string") {
    notes = notes.replace(/\s+/g, " ").trim().slice(0, NOTES_MAX_LENGTH);
  } else {
    notes = "";
  }

  return {
    id,
    kind: raw.kind as string | undefined,
    sectionTypes: Array.isArray(raw.sectionTypes) ? raw.sectionTypes : [],
    priority: typeof raw.priority === "number" ? raw.priority : 0,
    fallback: raw.fallback === true,
    when,
    notes,
  };
}

/**
 * 扫描目录下所有 .md 文件，解析 frontmatter，返回 SkillMetadata[]
 * 仅包含有 id 且 id 非空的 skill
 */
export function discoverSkills(rootPath: string): SkillMetadata[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const entries = readdirSync(rootPath, { withFileTypes: true });
  const result: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const fullPath = join(rootPath, entry.name);
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const stripped = matter(content);
    const frontmatter = stripped.data as Record<string, unknown>;
    const id = frontmatter.id as string | undefined;
    if (!id || typeof id !== "string") {
      continue;
    }

    result.push(parseSkillMetadata(frontmatter, id));
  }

  return result;
}

/**
 * 按 sectionTypes 过滤：只返回 sectionTypes 包含给定 type 的 skills
 * 按 priority 降序
 */
export function discoverSkillsBySectionType(
  rootPath: string,
  sectionType: string
): SkillMetadata[] {
  const all = discoverSkills(rootPath);
  return all
    .filter((s) => s.sectionTypes.includes(sectionType))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 为 LLM 准备的紧凑 metadata（不含 prompt 正文）
 */
export function toCompactMetadata(skill: SkillMetadata): Record<string, unknown> {
  return {
    id: skill.id,
    sectionTypes: skill.sectionTypes,
    priority: skill.priority,
    fallback: skill.fallback,
    when: skill.when,
    notes: skill.notes,
  };
}

/**
 * 根据 rootPath + id 加载 skill 完整内容（含 prompt 正文）
 * rootPath 由调用方传入，与 discoverSkills 保持一致。
 */
export function loadSkillContent(rootPath: string, skillId: string): string {
  const path = join(rootPath, `${skillId}.md`);
  if (!existsSync(path)) {
    return "";
  }
  const content = readFileSync(path, "utf-8");
  const parsed = matter(content);
  return parsed.content.trim();
}
