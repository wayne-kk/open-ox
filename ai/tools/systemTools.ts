/**
 * System Tools - 网站生成 Agent 常用工具
 * read_file, write_file, search_code, exec_shell, install_package, format_code, run_build
 */

import { writeFileSync, readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "./types";

const WORKSPACE_ROOT = process.cwd();

/** 安全路径：不允许跳出 workspace */
function resolvePath(relativePath: string): string {
  const resolved = join(WORKSPACE_ROOT, relativePath);
  const real = resolved.replace(/\/+/g, "/");
  if (!real.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path outside workspace: ${relativePath}`);
  }
  return real;
}

export const systemTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Creates missing directories. Use for generated code.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from project root (e.g. app/page.tsx)" },
          content: { type: "string", description: "File content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read file content. Use to inspect existing code before modifying.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from project root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exec_shell",
      description: "Execute shell command. Use for: pnpm add, pnpm install, npm run build, etc. Missing dependencies: pnpm add <pkg>.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run (e.g. pnpm add lodash)" },
          cwd: { type: "string", description: "Working directory, default project root" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List directory contents. Use to explore project structure.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from project root, default '.'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for pattern in codebase. Use to find usages, definitions, or similar code.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Search pattern (regex or plain text)" },
          path: { type: "string", description: "Directory to search, default '.'" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_package",
      description: "Install npm package. Use when code references missing dependency.",
      parameters: {
        type: "object",
        properties: {
          package: { type: "string", description: "Package name (e.g. lodash, @radix-ui/react-dialog)" },
          dev: { type: "boolean", description: "Install as devDependency" },
        },
        required: ["package"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "format_code",
      description: "Format code file with Prettier. Use after writing to ensure style consistency.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to format" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_build",
      description: "Run project build. Use to verify generated code compiles.",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", description: "Build script name, default 'build'" },
        },
        required: [],
      },
    },
  },
];

export async function executeSystemTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | string> {
  try {
    switch (name) {
      case "write_file": {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = resolvePath(path);
        const { mkdirSync } = await import("fs");
        const dir = fullPath.replace(/\/[^/]+$/, "");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
        return { success: true, output: `Written to ${path}`, meta: { path } };
      }
      case "read_file": {
        const path = args.path as string;
        const fullPath = resolvePath(path);
        const content = readFileSync(fullPath, "utf-8");
        return { success: true, output: content, meta: { path } };
      }
      case "exec_shell": {
        const command = args.command as string;
        const cwd = (args.cwd as string) || ".";
        const fullCwd = resolvePath(cwd);
        const output = execSync(command, {
          cwd: fullCwd,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
        });
        return { success: true, output: output?.trim() ?? "" };
      }
      case "list_dir": {
        const path = (args.path as string) || ".";
        const fullPath = resolvePath(path);
        const entries = readdirSync(fullPath, { withFileTypes: true });
        const list = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
        return { success: true, output: list || "(empty)", meta: { path } };
      }
      case "search_code": {
        const pattern = args.pattern as string;
        const searchPath = (args.path as string) || ".";
        const fullPath = resolvePath(searchPath);
        try {
          const output = execSync(`rg "${pattern.replace(/"/g, '\\"')}" "${fullPath}" --no-heading -n 2>/dev/null || true`, {
            encoding: "utf-8",
            maxBuffer: 512 * 1024,
          });
          return { success: true, output: output?.trim() || "(no matches)", meta: { pattern } };
        } catch {
          return { success: true, output: "(search_code: rg not available, placeholder)", meta: { pattern } };
        }
      }
      case "install_package": {
        const pkg = args.package as string;
        const dev = args.dev as boolean;
        const cmd = dev ? `pnpm add -D ${pkg}` : `pnpm add ${pkg}`;
        try {
          const output = execSync(cmd, {
            cwd: WORKSPACE_ROOT,
            encoding: "utf-8",
            maxBuffer: 1024 * 1024,
          });
          return { success: true, output: output?.trim() ?? `Installed ${pkg}` };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg };
        }
      }
      case "format_code": {
        const path = args.path as string;
        const fullPath = resolvePath(path);
        try {
          execSync(`pnpm exec prettier --write "${fullPath}"`, {
            encoding: "utf-8",
          });
          return { success: true, output: `Formatted ${path}` };
        } catch {
          return { success: false, error: "format_code: Prettier not available (placeholder)" };
        }
      }
      case "run_build": {
        const script = (args.script as string) || "build";
        try {
          const output = execSync(`pnpm run ${script}`, {
            cwd: WORKSPACE_ROOT,
            encoding: "utf-8",
            maxBuffer: 1024 * 1024,
          });
          return { success: true, output: output?.trim() ?? "" };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg };
        }
      }
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
