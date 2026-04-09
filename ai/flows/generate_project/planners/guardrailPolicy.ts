import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import type { SectionSpec } from "../types";
import { getRulePromptsRoot } from "../shared/files";

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

type DefaultForScope = "all" | string[];

export interface SectionGuardrailRuleMeta {
  id: string;
  plannerOnly: boolean;
  defaultFor: DefaultForScope;
}

export interface ProjectGuardrailRuleMeta {
  id: string;
  plannerOnly: boolean;
}

let cachedSectionMetas: SectionGuardrailRuleMeta[] | null = null;
let cachedProjectMetas: ProjectGuardrailRuleMeta[] | null = null;

function normalizeDefaultForScope(data: Record<string, unknown>): DefaultForScope {
  const raw = data.guardrailDefaultFor;
  if (raw === "all" || raw == null) {
    return "all";
  }
  if (typeof raw === "string") {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  return "all";
}

function parseSectionRuleMeta(fileName: string, raw: string): SectionGuardrailRuleMeta {
  const id = fileName.slice(0, -3);
  const { data } = matter(raw);
  const record = data as Record<string, unknown>;
  const plannerOnly = record.guardrailPlannerOnly === true;
  return {
    id,
    plannerOnly,
    defaultFor: normalizeDefaultForScope(record),
  };
}

function parseProjectRuleMeta(fileName: string, raw: string): ProjectGuardrailRuleMeta {
  const id = fileName.slice(0, -3);
  const { data } = matter(raw);
  const record = data as Record<string, unknown>;
  return {
    id,
    plannerOnly: record.guardrailPlannerOnly === true,
  };
}

function discoverSectionGuardrailRuleMetas(): SectionGuardrailRuleMeta[] {
  const dir = getRulePromptsRoot();
  if (!existsSync(dir)) {
    return [];
  }

  const metas: SectionGuardrailRuleMeta[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || !entry.name.startsWith("section.")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    metas.push(parseSectionRuleMeta(entry.name, readFileSync(fullPath, "utf-8")));
  }
  return metas.sort((a, b) => a.id.localeCompare(b.id));
}

function discoverProjectGuardrailRuleMetas(): ProjectGuardrailRuleMeta[] {
  const dir = getRulePromptsRoot();
  if (!existsSync(dir)) {
    return [];
  }

  const metas: ProjectGuardrailRuleMeta[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || !entry.name.startsWith("project.")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    metas.push(parseProjectRuleMeta(entry.name, readFileSync(fullPath, "utf-8")));
  }
  return metas.sort((a, b) => a.id.localeCompare(b.id));
}

/** Section guardrails: one `section.*.md` per id under `prompts/rules/`. */
export function getSectionGuardrailRuleMetas(): SectionGuardrailRuleMeta[] {
  if (!cachedSectionMetas) {
    cachedSectionMetas = discoverSectionGuardrailRuleMetas();
  }
  return cachedSectionMetas;
}

/** Project guardrails: one `project.*.md` per id under `prompts/rules/`. */
export function getProjectGuardrailRuleMetas(): ProjectGuardrailRuleMeta[] {
  if (!cachedProjectMetas) {
    cachedProjectMetas = discoverProjectGuardrailRuleMetas();
  }
  return cachedProjectMetas;
}

export function getAllowedSectionGuardrailIds(): string[] {
  return getSectionGuardrailRuleMetas().map((m) => m.id);
}

export function getAllowedProjectGuardrailIds(): string[] {
  return getProjectGuardrailRuleMetas().map((m) => m.id);
}

function sectionGuardrailIdSet(): Set<string> {
  return new Set(getAllowedSectionGuardrailIds());
}

function projectGuardrailIdSet(): Set<string> {
  return new Set(getAllowedProjectGuardrailIds());
}

/**
 * Default section guardrails before `plan_project` runs.
 * Driven by each `section.*.md` file: optional YAML frontmatter
 * `guardrailDefaultFor` (`all` | section type | list of types) and `guardrailPlannerOnly`.
 */
export function inferSectionGuardrailDefaults(section: Pick<SectionSpec, "type">): string[] {
  const ids: string[] = [];
  for (const meta of getSectionGuardrailRuleMetas()) {
    if (meta.plannerOnly) {
      continue;
    }
    if (meta.defaultFor === "all") {
      ids.push(meta.id);
    } else if (meta.defaultFor.includes(section.type)) {
      ids.push(meta.id);
    }
  }
  return uniqueStrings(ids);
}

/** Default project guardrails: every discovered `project.*.md` with `guardrailPlannerOnly` not set. */
export function inferProjectGuardrailDefaults(): string[] {
  return getProjectGuardrailRuleMetas()
    .filter((m) => !m.plannerOnly)
    .map((m) => m.id);
}

/**
 * Merge planner output with defaults so the LLM cannot drop baseline guardrails.
 */
export function mergeProjectGuardrailIds(
  plannerIds: string[] | undefined,
  defaults: string[]
): string[] {
  const allowed = projectGuardrailIdSet();
  const fromPlanner = (plannerIds ?? []).filter((id) => allowed.has(id));
  return uniqueStrings([...defaults, ...fromPlanner]);
}

export function isAllowedSectionGuardrailId(id: string): boolean {
  return sectionGuardrailIdSet().has(id);
}

export function isAllowedProjectGuardrailId(id: string): boolean {
  return projectGuardrailIdSet().has(id);
}
