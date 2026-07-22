import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join, resolve as resolvePath } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import type {
  DesignSystemSkill,
  DesignSystemSkillCatalog,
  DesignSystemSkillMetadata,
  DesignSystemSurfaceMode,
} from "./types";
import { validateDesignSystemContract } from "./validator";

const METADATA_FILE = "metadata.yaml";
const CONTENT_FILE = "design-system.md";
const APPROVED_SKILL_IDS = [
  "minimal-dark",
  "newsprint",
  "bauhaus",
  "neo-brutalism",
  "luxury",
] as const;
const APPROVED_SKILL_ID_SET = new Set<string>(APPROVED_SKILL_IDS);
let cachedCatalog: DesignSystemSkillCatalog | null = null;

function resolveSkillsRoot(): string {
  const besideModule = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    "skills",
  );
  if (existsSync(besideModule)) return besideModule;
  return join(
    process.cwd(),
    "ai",
    "flows",
    "generate_project",
    "designSystem",
    "skills",
  );
}

function parseYaml(raw: string): Record<string, unknown> {
  return matter(`---\n${raw}\n---\n`).data as Record<string, unknown>;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function signalGroup(value: unknown): {
  moods: string[];
  colors: string[];
  productTypes: string[];
} {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    moods: strings(record.moods),
    colors: strings(record.colors),
    productTypes: strings(record.productTypes),
  };
}

function parseMetadata(
  raw: string,
  directoryId: string,
): DesignSystemSkillMetadata {
  const data = parseYaml(raw);
  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (!id || id !== directoryId) {
    throw new Error(`metadata id must match directory name "${directoryId}"`);
  }
  const version =
    typeof data.version === "string"
      ? data.version.trim()
      : String(data.version ?? "");
  const contractVersion = Number(data.contractVersion);
  if (data.status !== "active" && data.status !== "disabled") {
    throw new Error(`skill "${id}" has invalid status "${String(data.status)}"`);
  }
  const status = data.status;
  const supportedModes = strings(data.supportedModes).filter(
    (mode): mode is DesignSystemSurfaceMode =>
      mode === "marketing" || mode === "web-app",
  );
  if (
    !version ||
    !Number.isInteger(contractVersion) ||
    supportedModes.length === 0
  ) {
    throw new Error(
      `skill "${id}" has invalid version, contractVersion, or supportedModes`,
    );
  }

  return {
    id,
    version,
    contractVersion,
    status,
    aliases: strings(data.aliases),
    positiveSignals: signalGroup(data.positiveSignals),
    negativeSignals: signalGroup(data.negativeSignals),
    supportedModes,
  };
}

function loadSkills(): DesignSystemSkill[] {
  const root = resolveSkillsRoot();
  if (!existsSync(root)) return [];

  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const unexpected = directories.filter(
    (directory) => !APPROVED_SKILL_ID_SET.has(directory),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `design-system skill catalog contains unapproved directories: ${unexpected.join(", ")}`,
    );
  }

  return [...APPROVED_SKILL_IDS].sort().map((skillId) => {
    const skillRoot = join(root, skillId);
    const metadataPath = join(skillRoot, METADATA_FILE);
    const contentPath = join(skillRoot, CONTENT_FILE);
    if (!existsSync(metadataPath) || !existsSync(contentPath)) {
      throw new Error(
        `design-system skill "${skillId}" is missing metadata.yaml or design-system.md`,
      );
    }
    return {
      metadata: parseMetadata(readFileSync(metadataPath, "utf-8"), skillId),
      content: readFileSync(contentPath, "utf-8").trim(),
    };
  });
}

export function createFileDesignSystemSkillCatalog(): DesignSystemSkillCatalog {
  if (cachedCatalog) return cachedCatalog;
  const skills = loadSkills();
  const byId = new Map(skills.map((skill) => [skill.metadata.id, skill]));
  cachedCatalog = {
    list: () => [...skills],
    get: (id) => byId.get(id) ?? null,
  };
  return cachedCatalog;
}

export function validateDesignSystemSkillCatalog(): string[] {
  const errors: string[] = [];
  let catalog: DesignSystemSkillCatalog;
  try {
    catalog = createFileDesignSystemSkillCatalog();
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  if (catalog.list().filter((skill) => skill.metadata.status === "active").length === 0) {
    return ["design-system skill catalog has no active skills"];
  }

  for (const skill of catalog.list()) {
    const validation = validateDesignSystemContract(
      skill.content,
      skill.metadata.contractVersion,
    );
    for (const error of validation.errors) {
      errors.push(`${skill.metadata.id}: ${error}`);
    }
  }
  return errors;
}
