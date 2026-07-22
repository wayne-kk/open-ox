import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import type {
  DesignSystemSkill,
  DesignSystemSkillCatalog,
  DesignSystemSkillContentFormat,
  DesignSystemSkillMetadata,
  DesignSystemSurfaceMode,
} from "./types";
import {
  loadDesignSystemSkillContent,
  validateDesignSystemSkill,
} from "./skillContent";

const MANIFEST_FILE = "skill.yaml";
const MANIFEST_SCHEMA_VERSION = 1;
let cachedCatalog: DesignSystemSkillCatalog | null = null;

function resolveManifestRoot(): string {
  const besideModule = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "prompts",
    "skills",
    "design-system",
  );
  if (existsSync(join(besideModule, MANIFEST_FILE))) return besideModule;
  return join(
    process.cwd(),
    "ai",
    "flows",
    "generate_project",
    "prompts",
    "skills",
    "design-system",
  );
}

function parseYaml(raw: string): Record<string, unknown> {
  return matter(`---\n${raw}\n---\n`).data as Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be a string list`);
  }
  if (
    value.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    throw new Error(`${field} contains a non-string or empty value`);
  }
  return value.map((item) => (item as string).trim());
}

function signalGroup(value: unknown, field: string): {
  moods: string[];
  colors: string[];
  productTypes: string[];
} {
  const group = record(value);
  return {
    moods: stringList(group.moods, `${field}.moods`),
    colors: stringList(group.colors, `${field}.colors`),
    productTypes: stringList(group.productTypes, `${field}.productTypes`),
  };
}

function parseMetadata(data: Record<string, unknown>): {
  file: string;
  metadata: DesignSystemSkillMetadata;
} {
  const id = typeof data.id === "string" ? data.id.trim() : "";
  const file = typeof data.file === "string" ? data.file.trim() : "";
  const version =
    typeof data.version === "string"
      ? data.version.trim()
      : String(data.version ?? "");
  const contractVersion = Number(data.contractVersion);
  const contentFormat = data.contentFormat;
  const rawSupportedModes = stringList(
    data.supportedModes,
    `skill "${id}" supportedModes`,
  );
  if (
    rawSupportedModes.some(
      (mode) => mode !== "marketing" && mode !== "web-app",
    )
  ) {
    throw new Error(`skill "${id}" has an invalid supportedMode`);
  }
  const supportedModes = rawSupportedModes as DesignSystemSurfaceMode[];

  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`design-system skill has invalid id "${id}"`);
  }
  if (!file || isAbsolute(file)) {
    throw new Error(`skill "${id}" has invalid file "${file}"`);
  }
  if (!version || !Number.isInteger(contractVersion)) {
    throw new Error(`skill "${id}" has invalid version or contractVersion`);
  }
  if (data.status !== "active" && data.status !== "disabled") {
    throw new Error(`skill "${id}" has invalid status "${String(data.status)}"`);
  }
  if (contentFormat !== "open-ox-v1" && contentFormat !== "reference-v1") {
    throw new Error(
      `skill "${id}" has invalid contentFormat "${String(contentFormat)}"`,
    );
  }
  if (supportedModes.length === 0) {
    throw new Error(`skill "${id}" has no supportedModes`);
  }

  return {
    file,
    metadata: {
      id,
      version,
      contractVersion,
      contentFormat: contentFormat as DesignSystemSkillContentFormat,
      status: data.status,
      aliases: [
        ...new Set([
          id,
          ...stringList(data.aliases, `skill "${id}" aliases`),
        ]),
      ],
      positiveSignals: signalGroup(
        data.positiveSignals,
        `skill "${id}" positiveSignals`,
      ),
      negativeSignals: signalGroup(
        data.negativeSignals,
        `skill "${id}" negativeSignals`,
      ),
      supportedModes,
    },
  };
}

function assertPathInsideCatalog(root: string, contentPath: string): void {
  const relativePath = relative(root, contentPath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`design-system skill file escapes catalog: ${contentPath}`);
  }
}

function loadSkills(): DesignSystemSkill[] {
  const root = resolveManifestRoot();
  const manifestPath = join(root, MANIFEST_FILE);
  if (!existsSync(manifestPath)) return [];

  const manifest = parseYaml(readFileSync(manifestPath, "utf-8"));
  if (Number(manifest.schemaVersion) !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `unsupported design-system skill manifest schema ${String(manifest.schemaVersion)}`,
    );
  }
  const defaults = record(manifest.defaults);
  if (!Array.isArray(manifest.skills)) {
    throw new Error("design-system skill manifest must contain a skills list");
  }

  const ids = new Set<string>();
  const resolvedFiles = new Set<string>();
  const skills = manifest.skills.map((value) => {
    const entry = { ...defaults, ...record(value) };
    const { file, metadata } = parseMetadata(entry);
    if (ids.has(metadata.id)) {
      throw new Error(`duplicate design-system skill id "${metadata.id}"`);
    }
    ids.add(metadata.id);

    const contentPath = resolvePath(root, file);
    assertPathInsideCatalog(root, contentPath);
    if (resolvedFiles.has(contentPath)) {
      throw new Error(`duplicate design-system skill file "${file}"`);
    }
    resolvedFiles.add(contentPath);
    if (!existsSync(contentPath)) {
      throw new Error(`design-system skill "${metadata.id}" is missing ${file}`);
    }

    const raw = readFileSync(contentPath, "utf-8");
    return {
      metadata,
      content: loadDesignSystemSkillContent(raw, metadata),
    };
  });

  const unlistedLocalFiles = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolvePath(root, entry.name))
    .filter((contentPath) => !resolvedFiles.has(contentPath));
  if (unlistedLocalFiles.length > 0) {
    throw new Error(
      `design-system skill manifest does not list: ${unlistedLocalFiles
        .map((contentPath) => relative(root, contentPath))
        .join(", ")}`,
    );
  }

  return skills;
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
  let catalog: DesignSystemSkillCatalog;
  try {
    catalog = createFileDesignSystemSkillCatalog();
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  const errors: string[] = [];
  if (
    catalog.list().filter((skill) => skill.metadata.status === "active")
      .length === 0
  ) {
    return ["design-system skill catalog has no active skills"];
  }

  for (const skill of catalog.list()) {
    const validation = validateDesignSystemSkill(skill);
    for (const error of validation.errors) {
      errors.push(`${skill.metadata.id}: ${error}`);
    }
  }
  return errors;
}
