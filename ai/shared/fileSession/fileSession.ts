import { createHash } from "node:crypto";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export interface FileSessionDiagnostic {
  path: string;
  message: string;
  line?: number;
  column?: number;
  revision?: string;
}

export interface FileSessionMutationResult {
  content: string;
  revision: string;
  diagnostics: FileSessionDiagnostic[];
}

export interface FileSessionWorkspace {
  read(path: string): Promise<{ content: string; revision: string }>;
  createOrReplace(
    path: string,
    content: string,
    expectedRevision?: string,
  ): Promise<FileSessionMutationResult>;
  patch(
    path: string,
    baseRevision: string,
    edits: FileSessionTextEdit[],
  ): Promise<FileSessionMutationResult>;
  verify(paths: string[]): Promise<Map<string, FileSessionDiagnostic[]>>;
}

export interface FileSessionTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

export type FileSessionCall =
  | { name: "create_file"; args: { path: string; content: string } }
  | { name: "read_file_snapshot"; args: { path: string } }
  | {
      name: "apply_file_patch";
      args: { path: string; baseRevision: string; edits: FileSessionTextEdit[] };
    }
  | { name: "verify_files"; args: { paths?: string[] } };

export interface FileSessionEvent {
  success: boolean;
  kind: "file_created" | "file_snapshot" | "file_updated" | "files_verified" | "error";
  cached: boolean;
  path?: string;
  revision?: string;
  diagnostics?: FileSessionDiagnostic[];
  code?: string;
  error?: string;
  content?: string;
}

export interface FileSessionOptions {
  owner: string;
  workspace: FileSessionWorkspace;
  ownsPath(path: string): boolean;
  requiredArtifacts: string[];
  replaceableBaselinePaths?: string[];
  validateArtifact?(path: string, content: string): string | null;
  validateCompletion?(context: FileSessionCompletionContext): string | null;
  maxConsecutiveFailuresPerFile?: number;
  maxFiles?: number;
  maxMutationsPerFile?: number;
}

export interface FileSessionArtifact {
  content: string;
  revision: string;
}

export interface FileSessionCompletionContext {
  artifacts: ReadonlyMap<string, FileSessionArtifact>;
}

interface FileRecord {
  content: string;
  revision: string;
  diagnostics: FileSessionDiagnostic[];
}

export interface FileSession {
  tools(): ChatCompletionTool[];
  execute(call: FileSessionCall): Promise<FileSessionEvent>;
  events(): FileSessionEvent[];
  writtenPaths(): string[];
  stopDecision():
    | { kind: "continue"; reason: string }
    | { kind: "complete" }
    | { kind: "failed"; error: string };
}

function revisionOf(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function commandDigest(call: FileSessionCall): string {
  return revisionOf(JSON.stringify(call));
}

export function createFileSession(options: FileSessionOptions): FileSession {
  const records = new Map<string, FileRecord>();
  const cachedCalls = new Map<string, FileSessionEvent>();
  const emittedEvents: FileSessionEvent[] = [];
  const replaceable = new Set(options.replaceableBaselinePaths ?? []);
  const consecutiveFailures = new Map<string, number>();
  const needsSnapshot = new Set<string>();
  const editableSnapshots = new Set<string>();
  const mutationCounts = new Map<string, number>();
  let terminalError: string | null = null;

  const executeCore = async (call: FileSessionCall): Promise<FileSessionEvent> => {
    const digest = commandDigest(call);
    const cacheableMutation =
      call.name === "create_file" || call.name === "apply_file_patch";
    const cached = cacheableMutation ? cachedCalls.get(digest) : undefined;
    if (cached) return { ...cached, cached: true };

    const path = "path" in call.args ? call.args.path : undefined;
    if (path && !options.ownsPath(path)) {
      terminalError = `${options.owner} does not own ${path}`;
      return {
        success: false,
        kind: "error",
        cached: false,
        code: "PATH_NOT_OWNED",
        path,
        error: `${options.owner} does not own ${path}`,
      };
    }

    if (call.name === "read_file_snapshot") {
      const snapshot = await options.workspace.read(call.args.path);
      const previous = records.get(call.args.path);
      records.set(call.args.path, {
        content: snapshot.content,
        revision: snapshot.revision,
        diagnostics:
          previous?.revision === snapshot.revision ? previous.diagnostics : [],
      });
      needsSnapshot.delete(call.args.path);
      editableSnapshots.add(call.args.path);
      const event: FileSessionEvent = {
        success: true,
        kind: "file_snapshot",
        cached: false,
        path: call.args.path,
        revision: snapshot.revision,
        diagnostics: previous?.diagnostics ?? [],
        content: snapshot.content,
      };
      emittedEvents.push(event);
      return event;
    }

    if (call.name === "apply_file_patch") {
      const record = records.get(call.args.path);
      if (
        needsSnapshot.has(call.args.path) ||
        !editableSnapshots.has(call.args.path) ||
        !record ||
        record.revision !== call.args.baseRevision
      ) {
        needsSnapshot.add(call.args.path);
        return {
          success: false,
          kind: "error",
          cached: false,
          code: "STALE_REVISION",
          path: call.args.path,
          revision: record?.revision,
          error: `Read a fresh snapshot of ${call.args.path} before patching`,
        };
      }
      if ((mutationCounts.get(call.args.path) ?? 0) >= (options.maxMutationsPerFile ?? 4)) {
        terminalError = `Mutation limit exceeded for ${call.args.path}`;
        return { success: false, kind: "error", cached: false, path: call.args.path, code: "MUTATION_LIMIT", error: terminalError };
      }
      const mutation = await options.workspace.patch(
        call.args.path,
        call.args.baseRevision,
        call.args.edits,
      );
      records.set(call.args.path, {
        content: mutation.content,
        revision: mutation.revision,
        diagnostics: mutation.diagnostics.map((item) => ({ ...item, revision: mutation.revision })),
      });
      editableSnapshots.delete(call.args.path);
      mutationCounts.set(call.args.path, (mutationCounts.get(call.args.path) ?? 0) + 1);
      const event: FileSessionEvent = {
        success: true,
        kind: "file_updated",
        cached: false,
        path: call.args.path,
        revision: mutation.revision,
        diagnostics: mutation.diagnostics.map((item) => ({ ...item, revision: mutation.revision })),
      };
      cachedCalls.set(digest, event);
      emittedEvents.push(event);
      return event;
    }

    if (call.name === "verify_files") {
      const paths = call.args.paths ?? [...records.keys()];
      const unownedPath = paths.find((verifiedPath) => !options.ownsPath(verifiedPath));
      if (unownedPath) {
        terminalError = `${options.owner} does not own ${unownedPath}`;
        return {
          success: false,
          kind: "error",
          cached: false,
          path: unownedPath,
          code: "PATH_NOT_OWNED",
          error: terminalError,
        };
      }
      const verified = await options.workspace.verify(paths);
      for (const verifiedPath of paths) {
        const record = records.get(verifiedPath);
        if (record) {
          const current = await options.workspace.read(verifiedPath);
          if (current.revision !== record.revision) {
            records.set(verifiedPath, { ...current, diagnostics: [] });
            needsSnapshot.add(verifiedPath);
          } else {
            record.diagnostics = (verified.get(verifiedPath) ?? []).map((item) => ({
              ...item,
              revision: current.revision,
            }));
          }
        }
      }
      const event: FileSessionEvent = {
        success: true,
        kind: "files_verified",
        cached: false,
        diagnostics: paths.flatMap((verifiedPath) => records.get(verifiedPath)?.diagnostics ?? []),
      };
      emittedEvents.push(event);
      return event;
    }

    if (records.has(call.args.path)) {
      return {
        success: false,
        kind: "error",
        cached: false,
        code: "FILE_ALREADY_CREATED",
        path: call.args.path,
        error: `${call.args.path} was already created in this session`,
      };
    }

    let expectedRevision: string | undefined;
    if (!replaceable.has(call.args.path)) {
      try {
        await options.workspace.read(call.args.path);
        return {
          success: false,
          kind: "error",
          cached: false,
          code: "FILE_ALREADY_EXISTS",
          path: call.args.path,
          error: `${call.args.path} already exists`,
        };
      } catch {
        // Missing files are valid create targets.
      }
    } else {
      expectedRevision = (await options.workspace.read(call.args.path)).revision;
    }

    if (records.size >= (options.maxFiles ?? 8) && !records.has(call.args.path)) {
      terminalError = `File limit exceeded for ${options.owner}`;
      return { success: false, kind: "error", cached: false, path: call.args.path, code: "FILE_LIMIT", error: terminalError };
    }
    const mutation = await options.workspace.createOrReplace(
      call.args.path,
      call.args.content,
      expectedRevision,
    );
    records.set(call.args.path, {
      content: mutation.content,
      revision: mutation.revision,
      diagnostics: mutation.diagnostics.map((item) => ({ ...item, revision: mutation.revision })),
    });
    mutationCounts.set(call.args.path, 1);
    const event: FileSessionEvent = {
      success: true,
      kind: "file_created",
      cached: false,
      path: call.args.path,
      revision: mutation.revision,
      diagnostics: mutation.diagnostics.map((item) => ({ ...item, revision: mutation.revision })),
    };
    cachedCalls.set(digest, event);
    emittedEvents.push(event);
    return event;
  };

  let commandQueue = Promise.resolve();
  const execute = (call: FileSessionCall): Promise<FileSessionEvent> => {
    const result = commandQueue.then(() => executeCore(call)).catch((cause: unknown) => {
      const path = "path" in call.args ? call.args.path : undefined;
      const message = cause instanceof Error ? cause.message : String(cause);
      return {
        success: false,
        kind: "error" as const,
        cached: false,
        path,
        code: message.includes("STALE_REVISION") ? "STALE_REVISION" : "WORKSPACE_ERROR",
        error: message,
      };
    }).then((event) => {
      const path = event.path;
      if (path) {
        if (event.success) {
          consecutiveFailures.set(path, 0);
        } else {
          const failures = (consecutiveFailures.get(path) ?? 0) + 1;
          consecutiveFailures.set(path, failures);
          if (failures >= (options.maxConsecutiveFailuresPerFile ?? 2)) {
            terminalError = `${path} failed ${failures} consecutive file command(s): ${event.code ?? "UNKNOWN"}`;
          }
        }
      }
      return event;
    });
    commandQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const stopDecision: FileSession["stopDecision"] = () => {
    if (terminalError) return { kind: "failed", error: terminalError };
    for (const requiredPath of options.requiredArtifacts) {
      const record = records.get(requiredPath);
      if (!record) return { kind: "continue", reason: `${requiredPath} is missing` };
      const invalidReason = options.validateArtifact?.(requiredPath, record.content);
      if (invalidReason) return { kind: "continue", reason: invalidReason };
    }
    if (needsSnapshot.size > 0) {
      return { kind: "continue", reason: `${[...needsSnapshot][0]} needs a fresh snapshot` };
    }
    const openDiagnostics = [...records.values()].reduce(
      (count, record) => count + record.diagnostics.length,
      0,
    );
    if (openDiagnostics > 0) {
      return { kind: "continue", reason: `${openDiagnostics} diagnostic(s) remain` };
    }
    const completionReason = options.validateCompletion?.({
      artifacts: new Map(
        [...records.entries()]
          .filter(
            ([path]) =>
              options.requiredArtifacts.includes(path) ||
              emittedEvents.some(
                (event) =>
                  event.path === path &&
                  (event.kind === "file_created" || event.kind === "file_updated"),
              ),
          )
          .map(([path, record]) => [
            path,
            { content: record.content, revision: record.revision },
          ]),
      ),
    });
    if (completionReason) return { kind: "continue", reason: completionReason };
    return { kind: "complete" };
  };

  return {
    tools: () => {
      if (terminalError) return [];
      if (needsSnapshot.size > 0) {
        return fileSessionTools.filter(
          (tool) => tool.function?.name === "read_file_snapshot",
        );
      }
      return fileSessionTools;
    },
    execute,
    events: () => [...emittedEvents],
    writtenPaths: () =>
      [...records.keys()].filter((path) =>
        emittedEvents.some(
          (event) =>
            event.path === path &&
            (event.kind === "file_created" || event.kind === "file_updated"),
        ),
      ),
    stopDecision,
  };
}

export const fileSessionTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new session-owned file. A path can be created only once; use apply_file_patch for later changes.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_snapshot",
      description: "Read canonical current content and its revision before patching.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_file_patch",
      description: "Atomically apply 0-based UTF-16 text edits to an exact snapshot revision.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          baseRevision: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                range: {
                  type: "object",
                  properties: {
                    start: {
                      type: "object",
                      properties: { line: { type: "number" }, character: { type: "number" } },
                      required: ["line", "character"],
                    },
                    end: {
                      type: "object",
                      properties: { line: { type: "number" }, character: { type: "number" } },
                      required: ["line", "character"],
                    },
                  },
                  required: ["start", "end"],
                },
                newText: { type: "string" },
              },
              required: ["range", "newText"],
            },
          },
        },
        required: ["path", "baseRevision", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_files",
      description: "Verify session files and refresh diagnostics. Completion is decided automatically after verification.",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
];

export class InMemoryFileSessionWorkspace implements FileSessionWorkspace {
  private readonly files: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.files = new Map(Object.entries(initial));
  }

  async read(path: string): Promise<{ content: string; revision: string }> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return { content, revision: revisionOf(content) };
  }

  async readText(path: string): Promise<string> {
    return (await this.read(path)).content;
  }

  async createOrReplace(
    path: string,
    content: string,
    expectedRevision?: string,
  ): Promise<FileSessionMutationResult> {
    if (expectedRevision && (await this.read(path)).revision !== expectedRevision) {
      throw new Error("STALE_REVISION");
    }
    this.files.set(path, content);
    return { content, revision: revisionOf(content), diagnostics: [] };
  }

  async patch(
    path: string,
    baseRevision: string,
    edits: FileSessionTextEdit[],
  ): Promise<FileSessionMutationResult> {
    const snapshot = await this.read(path);
    if (snapshot.revision !== baseRevision) throw new Error("STALE_REVISION");
    const lines = snapshot.content.split("\n");
    const lineOffsets: number[] = [];
    let offset = 0;
    for (const line of lines) {
      lineOffsets.push(offset);
      offset += line.length + 1;
    }
    const positioned = edits
      .map((edit) => ({
        start: lineOffsets[edit.range.start.line] + edit.range.start.character,
        end: lineOffsets[edit.range.end.line] + edit.range.end.character,
        newText: edit.newText,
      }))
      .sort((a, b) => b.start - a.start);
    let content = snapshot.content;
    for (const edit of positioned) {
      content = content.slice(0, edit.start) + edit.newText + content.slice(edit.end);
    }
    this.files.set(path, content);
    return { content, revision: revisionOf(content), diagnostics: [] };
  }

  async verify(paths: string[]): Promise<Map<string, FileSessionDiagnostic[]>> {
    return new Map(paths.map((path) => [path, []]));
  }
}
