import fs from "fs/promises";
import path from "path";
import { Dirent } from "fs";

export const WORKSPACE_ROOT = process.cwd();
export const REGISTRY_PATH = path.join(WORKSPACE_ROOT, ".open-ox", "projects.json");

const REGISTRY_TMP_PATH = REGISTRY_PATH + ".tmp";
const OPEN_OX_DIR = path.join(WORKSPACE_ROOT, ".open-ox");

export interface ModificationRecord {
    instruction: string;
    modifiedAt: string;
    touchedFiles: string[];
}

export interface ProjectMetadata {
    id: string;
    name: string;
    userPrompt: string;
    status: "generating" | "ready" | "failed";
    createdAt: string; // ISO 8601
    updatedAt: string;
    completedAt?: string;
    error?: string;
    verificationStatus?: "passed" | "failed";
    blueprint?: unknown;
    modificationHistory: ModificationRecord[];
}

interface RegistryFile {
    projects: ProjectMetadata[];
}

export async function listProjects(): Promise<ProjectMetadata[]> {
    try {
        const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
        const parsed: RegistryFile = JSON.parse(raw);
        if (!Array.isArray(parsed.projects)) {
            console.error("[projectManager] Registry missing 'projects' array, returning []");
            return [];
        }
        return parsed.projects;
    } catch (err: unknown) {
        if (isNodeError(err) && err.code === "ENOENT") {
            // File doesn't exist yet — normal on first run
            return [];
        }
        console.error("[projectManager] Failed to read registry, returning []:", err);
        return [];
    }
}

export async function getProject(id: string): Promise<ProjectMetadata | null> {
    const projects = await listProjects();
    return projects.find((p) => p.id === id) ?? null;
}

export async function writeRegistry(projects: ProjectMetadata[]): Promise<void> {
    await fs.mkdir(OPEN_OX_DIR, { recursive: true });
    const content = JSON.stringify({ projects }, null, 2);
    await fs.writeFile(REGISTRY_TMP_PATH, content, "utf-8");
    await fs.rename(REGISTRY_TMP_PATH, REGISTRY_PATH);
}

// Type guard for Node.js errors with a `code` property
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
    return typeof err === "object" && err !== null && "code" in err;
}

export function getSiteRoot(projectId: string): string {
    const sitesDir = path.join(WORKSPACE_ROOT, "sites");
    const resolved = path.join(sitesDir, projectId);
    // Prevent path traversal: resolved path must start with sitesDir + separator
    if (!resolved.startsWith(sitesDir + path.sep) && resolved !== sitesDir) {
        throw new Error(`Path traversal detected: "${projectId}" escapes WORKSPACE_ROOT/sites/`);
    }
    return resolved;
}

export async function createProject(userPrompt: string): Promise<ProjectMetadata> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, "-").replace(/\./g, "-");

    const slug = userPrompt
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const id = `${timestamp}_${slug}`;
    const createdAt = now.toISOString();

    const project: ProjectMetadata = {
        id,
        name: slug,
        userPrompt,
        status: "generating",
        createdAt,
        updatedAt: createdAt,
        modificationHistory: [],
    };

    const projects = await listProjects();
    projects.push(project);
    await writeRegistry(projects);

    return project;
}

export async function updateProjectStatus(
    id: string,
    status: ProjectMetadata["status"],
    extra?: Partial<ProjectMetadata>
): Promise<void> {
    const projects = await listProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Project not found: ${id}`);
    projects[idx] = {
        ...projects[idx],
        ...extra,
        status,
        updatedAt: new Date().toISOString(),
    };
    await writeRegistry(projects);
}

export async function renameProject(id: string, name: string): Promise<void> {
    const projects = await listProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Project not found: ${id}`);
    projects[idx] = { ...projects[idx], name, updatedAt: new Date().toISOString() };
    await writeRegistry(projects);
}

export async function deleteProject(id: string): Promise<void> {
    const projects = await listProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Project not found: ${id}`);
    const remaining = projects.filter((p) => p.id !== id);
    await writeRegistry(remaining);
    await fs.rm(getSiteRoot(id), { recursive: true, force: true });
}

// Files/dirs to exclude when copying from template (AI-generated content + build artifacts)
const TEMPLATE_EXCLUDE = new Set([
    "components/sections",
    "app/page.tsx",
    "app/layout.tsx",
    "app/globals.css",
    "design-system.md",
    // build/runtime artifacts — never copy these
    ".git",
    ".next",
    "node_modules",
    "pnpm-lock.yaml",
    "tsconfig.tsbuildinfo",
]);

/**
 * Recursively copy files from src to dest, skipping paths in the exclude set.
 * excludeRelPaths are relative to the template root (e.g. "components/sections").
 */
async function copyTemplateDir(
    src: string,
    dest: string,
    templateRoot: string
): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries: Dirent[] = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const relPath = path.relative(templateRoot, path.join(src, entry.name));
        // Normalise to forward slashes for consistent matching
        const relPathNorm = relPath.split(path.sep).join("/");

        // Check if this entry (or any ancestor) is excluded
        const excluded = [...TEMPLATE_EXCLUDE].some(
            (ex) => relPathNorm === ex || relPathNorm.startsWith(ex + "/")
        );
        if (excluded) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyTemplateDir(srcPath, destPath, templateRoot);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Initialise a new project directory by copying the template scaffold,
 * updating package.json name, and stripping shared root dependencies.
 *
 * Throws (and sets project status to "failed") if:
 *  - The template directory is missing or copy fails
 *  - package.json or next.config.ts are absent after copy
 */
export async function initProjectDir(projectId: string): Promise<void> {
    const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
    const projectDir = getSiteRoot(projectId);

    try {
        // Verify template exists
        await fs.access(templateDir);
    } catch {
        await updateProjectStatus(projectId, "failed", {
            error: `Template directory not found: ${templateDir}`,
        });
        throw new Error(`Template directory not found: ${templateDir}`);
    }

    try {
        // Copy template files (excluding AI-generated and build artifacts)
        await copyTemplateDir(templateDir, projectDir, templateDir);

        // Validate required files exist
        const pkgPath = path.join(projectDir, "package.json");
        const nextConfigPath = path.join(projectDir, "next.config.ts");

        for (const requiredFile of [pkgPath, nextConfigPath]) {
            try {
                await fs.access(requiredFile);
            } catch {
                throw new Error(
                    `Required file missing after template copy: ${path.relative(projectDir, requiredFile)}`
                );
            }
        }

        // Read root package.json to determine shared deps to strip
        const rootPkgPath = path.join(WORKSPACE_ROOT, "package.json");
        const rootPkgRaw = await fs.readFile(rootPkgPath, "utf-8");
        const rootPkg = JSON.parse(rootPkgRaw) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const sharedDeps = new Set([
            ...Object.keys(rootPkg.dependencies ?? {}),
            ...Object.keys(rootPkg.devDependencies ?? {}),
        ]);

        // Update project package.json: set name, strip shared deps
        const projPkgRaw = await fs.readFile(pkgPath, "utf-8");
        const projPkg = JSON.parse(projPkgRaw) as {
            name?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            [key: string]: unknown;
        };

        projPkg.name = projectId;

        if (projPkg.dependencies) {
            for (const dep of Object.keys(projPkg.dependencies)) {
                if (sharedDeps.has(dep)) {
                    delete projPkg.dependencies[dep];
                }
            }
            if (Object.keys(projPkg.dependencies).length === 0) {
                delete projPkg.dependencies;
            }
        }

        if (projPkg.devDependencies) {
            for (const dep of Object.keys(projPkg.devDependencies)) {
                if (sharedDeps.has(dep)) {
                    delete projPkg.devDependencies[dep];
                }
            }
            if (Object.keys(projPkg.devDependencies).length === 0) {
                delete projPkg.devDependencies;
            }
        }

        await fs.writeFile(pkgPath, JSON.stringify(projPkg, null, 2) + "\n", "utf-8");

        // Create a node_modules symlink pointing to the template's node_modules.
        // This lets the project resolve all shared dependencies without a separate
        // pnpm install, and without polluting the root pnpm-lock.yaml.
        const templateNodeModules = path.join(templateDir, "node_modules");
        const projectNodeModules = path.join(projectDir, "node_modules");
        try {
            await fs.access(templateNodeModules);
            await fs.symlink(templateNodeModules, projectNodeModules, "dir");
        } catch (symlinkErr: unknown) {
            // Non-fatal: if template node_modules doesn't exist yet, the project
            // will still work once the user runs pnpm install in sites/template.
            console.warn(
                `[initProjectDir] Could not create node_modules symlink: ${symlinkErr instanceof Error ? symlinkErr.message : String(symlinkErr)}`
            );
        }
    } catch (err: unknown) {
        // Clean up partially-created directory
        await fs.rm(projectDir, { recursive: true, force: true });

        const message = err instanceof Error ? err.message : String(err);
        await updateProjectStatus(projectId, "failed", { error: message });
        throw err;
    }
}
