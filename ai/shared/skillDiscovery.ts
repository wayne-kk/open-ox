/**
 * Generic skill discovery — 任何 agent 均可调用
 *
 * 当前生成流水线使用 section skill：
 *   `section/<sectionType>/` — 通过 `discoverSkillsBySectionType` + `discoverAndSelectSkill` 选择
 *
 * 支持的 skill 文件格式（均为 section skill）：
 *   1. 新格式：独立 .yaml（metadata）+ .md（prompt 正文），文件名相同
 *   2. 旧格式：单个 .md 文件，metadata 写在 YAML frontmatter 中
 *   3. 聚合：`section/<类型>/skills.yaml`，根键 `skills:`，每项 `name` 作 id，`keywords` / `exclude_keywords` 映射到 `when.designKeywords`
 *
 * rootPath 由调用方传入，例如：
 *   - generate_project flow: ai/flows/generate_project/prompts/skills/
 *   - 未来其他 agent: ai/skills/<agent-name>/
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

const NOTES_MAX_LENGTH = 80;
const _skillDiscoveryCache = new Map<string, SkillMetadata[]>();

export interface SkillWhenCondition {
  designKeywords?: { any: string[]; none: string[] };
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

export interface SkillFrontmatterError {
  fileName: string;
  message: string;
}

/**
 * 从 raw object 解析出 SkillMetadata，兼容缺失字段
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

// ── File collection helpers ──────────────────────────────────────────────

interface CollectedFile {
  fullPath: string;
  name: string;
}

/**
 * Recursively collect files matching a given extension under a directory.
 */
function collectFiles(dir: string, ext: string): CollectedFile[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const results: CollectedFile[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push({ fullPath: entryPath, name: entry.name });
    } else if (entry.isDirectory()) {
      results.push(...collectFiles(entryPath, ext));
    }
  }
  return results;
}

function collectMarkdownFiles(dir: string): CollectedFile[] {
  return collectFiles(dir, ".md");
}

function collectYamlFiles(dir: string): CollectedFile[] {
  return collectFiles(dir, ".yaml");
}

// ── YAML parsing (reuse gray-matter's engine for .yaml files) ────────────

/**
 * Parse a standalone .yaml file into a plain object.
 * Uses gray-matter by wrapping content in frontmatter delimiters.
 */
function parseYamlFile(content: string): Record<string, unknown> {
  // Wrap in frontmatter delimiters so gray-matter can parse it
  const wrapped = `---\n${content}\n---\n`;
  const parsed = matter(wrapped);
  return parsed.data as Record<string, unknown>;
}

/**
 * Section bundles: `prompts/skills/section/<section>/skills.yaml` with top-level `skills:` array.
 * Each item uses `name` as id and `keywords` / `exclude_keywords` → `when.designKeywords`.
 */
function parseBundledSectionSkillsYaml(content: string, sourceLabel: string): SkillMetadata[] {
  let data: Record<string, unknown>;
  try {
    data = parseYamlFile(content);
  } catch (error) {
    console.warn(
      `[skill-discovery] Invalid YAML in bundled ${sourceLabel}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }

  const list = data.skills;
  if (!Array.isArray(list)) {
    console.warn(`[skill-discovery] bundled skills.yaml missing skills[] (${sourceLabel})`);
    return [];
  }

  const out: SkillMetadata[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const skillName = item.name;
    if (typeof skillName !== "string" || !skillName.trim()) continue;
    const id = skillName.trim();
    if (item.disabled === true) continue;

    let when: SkillWhenCondition | undefined;
    if (item.when && typeof item.when === "object") {
      when = item.when as SkillWhenCondition;
    } else if (Array.isArray(item.keywords) || Array.isArray(item.exclude_keywords)) {
      const anyKw = Array.isArray(item.keywords)
        ? item.keywords.filter((x): x is string => typeof x === "string")
        : [];
      const noneKw = Array.isArray(item.exclude_keywords)
        ? item.exclude_keywords.filter((x): x is string => typeof x === "string")
        : [];
      when = { designKeywords: { any: anyKw, none: noneKw } };
    }

    const record: Record<string, unknown> = {
      id,
      kind: item.kind,
      sectionTypes: item.sectionTypes,
      priority: item.priority,
      fallback: item.fallback,
      notes: item.notes,
      when,
    };
    out.push(parseSkillMetadata(record, id));
  }
  return out;
}

// ── Discovery ────────────────────────────────────────────────────────────

/**
 * 扫描目录下所有 skill（含子目录），返回 SkillMetadata[]
 *
 * 优先读取 .yaml 文件（新格式），同时兼容旧格式（.md with frontmatter）。
 * 如果同一个 id 同时存在 .yaml 和 .md frontmatter，.yaml 优先；聚合 skills.yaml 与 per-skill .yaml 冲突时，以先收集到的为准（同目录应避免重复 id）。
 */
export function discoverSkills(rootPath: string): SkillMetadata[] {
  const cached = _skillDiscoveryCache.get(rootPath);
  if (cached) {
    return [...cached];
  }

  if (!existsSync(rootPath)) {
    return [];
  }

  const result: SkillMetadata[] = [];
  const seenIds = new Set<string>();

  // ── Pass 1: .yaml files (new format) ──
  const yamlFiles = collectYamlFiles(rootPath);
  for (const { fullPath, name } of yamlFiles) {
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    if (name === "skills.yaml") {
      for (const meta of parseBundledSectionSkillsYaml(content, fullPath)) {
        if (seenIds.has(meta.id)) continue;
        seenIds.add(meta.id);
        result.push(meta);
      }
      continue;
    }

    let data: Record<string, unknown>;
    try {
      data = parseYamlFile(content);
    } catch (error) {
      console.warn(
        `[skill-discovery] Invalid YAML in ${name}: ${error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }

    const id = data.id as string | undefined;
    if (!id || typeof id !== "string") continue;
    if (data.disabled === true) continue;

    seenIds.add(id);
    result.push(parseSkillMetadata(data, id));
  }

  // ── Pass 2: .md files with frontmatter (legacy format) ──
  const mdFiles = collectMarkdownFiles(rootPath);
  for (const { fullPath, name } of mdFiles) {
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    // Skip .md files that don't start with frontmatter delimiter
    if (!content.trimStart().startsWith("---")) continue;

    let stripped: { data: unknown };
    try {
      stripped = matter(content);
    } catch (error) {
      console.warn(
        `[skill-discovery] Invalid frontmatter in ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }
    const frontmatter = stripped.data as Record<string, unknown>;
    const id = frontmatter.id as string | undefined;
    if (!id || typeof id !== "string") continue;

    // .yaml takes precedence — skip if already discovered
    if (seenIds.has(id)) continue;

    if (frontmatter.disabled === true) continue;

    seenIds.add(id);
    result.push(parseSkillMetadata(frontmatter, id));
  }

  _skillDiscoveryCache.set(rootPath, result);
  return [...result];
}

/**
 * Validate all skill files under a directory (recursive).
 * Validates both .yaml and .md (frontmatter) formats.
 * Returns structured errors so callers can fail fast with a clear message.
 */
export function validateSkillFrontmatter(rootPath: string): SkillFrontmatterError[] {
  if (!existsSync(rootPath)) return [];
  const errors: SkillFrontmatterError[] = [];

  // Validate .yaml files
  const yamlFiles = collectYamlFiles(rootPath);
  for (const { fullPath, name } of yamlFiles) {
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch (error) {
      errors.push({
        fileName: name,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (name === "skills.yaml") {
      const bundled = parseBundledSectionSkillsYaml(content, fullPath);
      if (bundled.length === 0) {
        errors.push({
          fileName: name,
          message: `bundled skills.yaml produced no valid skill entries (${fullPath})`,
        });
      }
      continue;
    }

    try {
      parseYamlFile(content);
    } catch (error) {
      errors.push({
        fileName: name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Validate legacy .md files with frontmatter
  const mdFiles = collectMarkdownFiles(rootPath);
  for (const { fullPath, name } of mdFiles) {
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch (error) {
      errors.push({
        fileName: name,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    // Only validate .md files that have frontmatter
    if (!content.trimStart().startsWith("---")) continue;

    try {
      matter(content);
    } catch (error) {
      errors.push({
        fileName: name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return errors;
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
 * 根据 rootPath + id 加载 skill 完整内容（prompt 正文）
 * rootPath 由调用方传入，与 discoverSkills 保持一致。
 * 支持子目录递归查找。
 *
 * 新格式：直接读取 {id}.md（纯 markdown，无 frontmatter）
 * 旧格式：读取 {id}.md 并用 gray-matter 剥离 frontmatter
 */
export function loadSkillContent(rootPath: string, skillId: string): string {
  // Try direct path first (fast path)
  const directPath = join(rootPath, `${skillId}.md`);
  const mdFiles = collectMarkdownFiles(rootPath);
  const targetPath = existsSync(directPath)
    ? directPath
    : mdFiles.find((f) => f.name === `${skillId}.md`)?.fullPath;

  if (!targetPath || !existsSync(targetPath)) {
    return "";
  }

  const content = readFileSync(targetPath, "utf-8");

  // New format: pure markdown (no frontmatter) — return as-is
  if (!content.trimStart().startsWith("---")) {
    return content.trim();
  }

  // Legacy format: strip frontmatter
  const parsed = matter(content);
  return parsed.content.trim();
}
