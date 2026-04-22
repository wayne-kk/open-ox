import fs from "fs/promises";
import path from "path";
export const WORKSPACE_ROOT = process.cwd();
function rowToMetadata(row) {
    return {
        id: row.id,
        name: row.name,
        userPrompt: row.user_prompt,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at ?? undefined,
        error: row.error ?? undefined,
        verificationStatus: row.verification_status ?? undefined,
        blueprint: row.blueprint,
        buildSteps: row.build_steps ?? undefined,
        generatedFiles: row.generated_files ?? undefined,
        logDirectory: row.log_directory ?? undefined,
        totalDuration: row.total_duration ?? undefined,
        modelId: row.model_id ?? undefined,
        generationMode: row.generation_mode ?? "web",
        folderId: row.folder_id ?? undefined,
        modificationHistory: row.modification_history ?? [],
        ...(row.user_id
            ? {
                ownerUserId: row.user_id,
                ownerUsername: row.owner_username ?? undefined,
            }
            : {}),
    };
}
export function getSiteRoot(projectId) {
    const sitesDir = path.join(WORKSPACE_ROOT, "sites");
    const resolved = path.join(sitesDir, projectId);
    if (!resolved.startsWith(sitesDir + path.sep) && resolved !== sitesDir) {
        throw new Error(`Path traversal detected: "${projectId}" escapes WORKSPACE_ROOT/sites/`);
    }
    return resolved;
}
export async function listProjects(db) {
    const { data, error } = await db
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) {
        console.error("[projectManager] listProjects error:", error.message);
        return [];
    }
    return data.map(rowToMetadata);
}
/**
 * Fast list query for dashboard/autocomplete.
 * Avoid selecting heavy JSON columns (blueprint/build_steps/generated_files/modification_history).
 * Pass `userId` to scope to one account (folder filters apply). Omit `userId` for all users (global gallery).
 */
export async function listProjectsSummary(db, options) {
    let query = db
        .from("projects")
        .select("id,name,user_prompt,status,created_at,updated_at,completed_at,error,verification_status,model_id,generation_mode,folder_id,user_id,owner_username")
        .order("created_at", { ascending: false });
    if (options.userId) {
        query = query.eq("user_id", options.userId);
        const folder = options.folder ?? "all";
        if (folder === "uncategorized") {
            query = query.is("folder_id", null);
        }
        else if (folder !== "all") {
            query = query.eq("folder_id", folder);
        }
    }
    else if (options.filterOwnerUserId) {
        query = query.eq("user_id", options.filterOwnerUserId);
    }
    if (typeof options.limit === "number" &&
        Number.isFinite(options.limit) &&
        options.limit > 0) {
        const offset = typeof options.offset === "number" &&
            Number.isFinite(options.offset) &&
            options.offset >= 0
            ? options.offset
            : 0;
        query = query.range(offset, offset + options.limit - 1);
    }
    const { data, error } = await query;
    if (error) {
        console.error("[projectManager] listProjectsSummary error:", error.message);
        return [];
    }
    return data.map((row) => ({
        id: row.id,
        name: row.name,
        userPrompt: row.user_prompt,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at ?? undefined,
        error: row.error ?? undefined,
        verificationStatus: row.verification_status ?? undefined,
        modelId: row.model_id ?? undefined,
        generationMode: row.generation_mode ?? "web",
        folderId: row.folder_id ?? undefined,
        modificationHistory: [],
        ownerUserId: row.user_id ?? undefined,
        ownerUsername: row.owner_username ?? undefined,
    }));
}
export async function getProject(db, id) {
    const { data, error } = await db.from("projects").select("*").eq("id", id).single();
    if (error || !data)
        return null;
    return rowToMetadata(data);
}
export async function createProject(db, args) {
    const { userPrompt, userId, ownerUsername, modelId, folderId, generationMode = "web", } = args;
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
    const row = {
        id,
        name: slug,
        user_prompt: userPrompt,
        status: "generating",
        created_at: createdAt,
        updated_at: createdAt,
        model_id: modelId ?? null,
        generation_mode: generationMode,
        user_id: userId,
        owner_username: ownerUsername,
        folder_id: folderId ?? null,
        modification_history: [],
    };
    const { data, error } = await db.from("projects").insert(row).select().single();
    if (error || !data) {
        throw new Error(`[projectManager] createProject failed: ${error?.message}`);
    }
    return rowToMetadata(data);
}
export async function updateProjectStatus(db, id, status, extra) {
    const update = {
        status,
        updated_at: new Date().toISOString(),
    };
    if (extra) {
        if (extra.completedAt !== undefined)
            update.completed_at = extra.completedAt;
        if (extra.error !== undefined)
            update.error = extra.error;
        if (extra.verificationStatus !== undefined)
            update.verification_status = extra.verificationStatus;
        if (extra.blueprint !== undefined)
            update.blueprint = extra.blueprint;
        if (extra.buildSteps !== undefined)
            update.build_steps = extra.buildSteps;
        if (extra.generatedFiles !== undefined)
            update.generated_files = extra.generatedFiles;
        if (extra.logDirectory !== undefined)
            update.log_directory = extra.logDirectory;
        if (extra.totalDuration !== undefined)
            update.total_duration = extra.totalDuration;
        if (extra.modificationHistory !== undefined)
            update.modification_history = extra.modificationHistory;
    }
    const maxRetries = 2;
    let lastMessage = "";
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const { error } = await db.from("projects").update(update).eq("id", id);
        if (!error)
            return;
        lastMessage = error.message ?? String(error);
        const lower = lastMessage.toLowerCase();
        const isRetryableNetworkError = lower.includes("fetch failed") ||
            lower.includes("network") ||
            lower.includes("socket") ||
            lower.includes("etimedout") ||
            lower.includes("econnreset");
        if (isRetryableNetworkError && attempt < maxRetries) {
            const delayMs = 300 * (attempt + 1);
            console.warn(`[projectManager] updateProjectStatus transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms: ${lastMessage}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
        }
        break;
    }
    throw new Error(`[projectManager] updateProjectStatus failed: ${lastMessage}`);
}
export async function setProjectFolder(db, projectId, folderId) {
    const { error } = await db
        .from("projects")
        .update({ folder_id: folderId, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    if (error)
        throw new Error(`[projectManager] setProjectFolder failed: ${error.message}`);
}
export async function renameProject(db, id, name) {
    const { error } = await db
        .from("projects")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw new Error(`[projectManager] renameProject failed: ${error.message}`);
}
export async function deleteProject(db, id) {
    const { error } = await db.from("projects").delete().eq("id", id);
    if (error)
        throw new Error(`[projectManager] deleteProject failed: ${error.message}`);
    await fs.rm(getSiteRoot(id), { recursive: true, force: true });
}
export async function appendBuildStep(db, id, step) {
    const { data: row, error: fetchErr } = await db.from("projects").select("build_steps").eq("id", id).single();
    if (fetchErr || !row)
        return;
    const existing = row.build_steps ?? [];
    const stepObj = step;
    const idx = existing.findIndex((s) => s.step === stepObj.step);
    const updated = idx >= 0 ? [...existing.slice(0, idx), step, ...existing.slice(idx + 1)] : [...existing, step];
    await db
        .from("projects")
        .update({ build_steps: updated, updated_at: new Date().toISOString() })
        .eq("id", id);
}
export async function addModificationRecord(db, id, record) {
    const project = await getProject(db, id);
    if (!project)
        throw new Error(`Project not found: ${id}`);
    const history = [...(project.modificationHistory ?? []), record];
    const { error } = await db
        .from("projects")
        .update({ modification_history: history, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw new Error(`[projectManager] addModificationRecord failed: ${error.message}`);
}
const TEMPLATE_EXCLUDE = new Set([
    "components/sections",
    "app/page.tsx",
    "app/layout.tsx",
    "app/globals.css",
    "design-system.md",
    ".git",
    ".next",
    "node_modules",
    "pnpm-lock.yaml",
    "tsconfig.tsbuildinfo",
]);
async function copyTemplateDir(src, dest, templateRoot) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const relPath = path.relative(templateRoot, path.join(src, entry.name));
        const relPathNorm = relPath.split(path.sep).join("/");
        const excluded = [...TEMPLATE_EXCLUDE].some((ex) => relPathNorm === ex || relPathNorm.startsWith(ex + "/"));
        if (excluded)
            continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyTemplateDir(srcPath, destPath, templateRoot);
        }
        else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
export async function initProjectDir(db, projectId) {
    const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
    const projectDir = getSiteRoot(projectId);
    try {
        await fs.access(templateDir);
    }
    catch {
        await updateProjectStatus(db, projectId, "failed", {
            error: `Template directory not found: ${templateDir}`,
        });
        throw new Error(`Template directory not found: ${templateDir}`);
    }
    try {
        await copyTemplateDir(templateDir, projectDir, templateDir);
        const pkgPath = path.join(projectDir, "package.json");
        const nextConfigPath = path.join(projectDir, "next.config.ts");
        for (const requiredFile of [pkgPath, nextConfigPath]) {
            try {
                await fs.access(requiredFile);
            }
            catch {
                throw new Error(`Required file missing after template copy: ${path.relative(projectDir, requiredFile)}`);
            }
        }
        const rootPkgRaw = await fs.readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf-8");
        const rootPkg = JSON.parse(rootPkgRaw);
        const sharedDeps = new Set([
            ...Object.keys(rootPkg.dependencies ?? {}),
            ...Object.keys(rootPkg.devDependencies ?? {}),
        ]);
        const projPkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
        projPkg.name = projectId;
        if (projPkg.dependencies) {
            for (const dep of Object.keys(projPkg.dependencies)) {
                if (sharedDeps.has(dep))
                    delete projPkg.dependencies[dep];
            }
            if (Object.keys(projPkg.dependencies).length === 0)
                delete projPkg.dependencies;
        }
        if (projPkg.devDependencies) {
            for (const dep of Object.keys(projPkg.devDependencies)) {
                if (sharedDeps.has(dep))
                    delete projPkg.devDependencies[dep];
            }
            if (Object.keys(projPkg.devDependencies).length === 0)
                delete projPkg.devDependencies;
        }
        await fs.writeFile(pkgPath, JSON.stringify(projPkg, null, 2) + "\n", "utf-8");
        const templateNodeModules = path.join(templateDir, "node_modules");
        const projectNodeModules = path.join(projectDir, "node_modules");
        try {
            await fs.access(templateNodeModules);
            await fs.symlink(templateNodeModules, projectNodeModules, "dir");
        }
        catch (symlinkErr) {
            console.warn(`[initProjectDir] Could not create node_modules symlink: ${symlinkErr instanceof Error ? symlinkErr.message : String(symlinkErr)}`);
        }
    }
    catch (err) {
        await fs.rm(projectDir, { recursive: true, force: true });
        const message = err instanceof Error ? err.message : String(err);
        await updateProjectStatus(db, projectId, "failed", { error: message });
        throw err;
    }
}
//# sourceMappingURL=projectManager.js.map