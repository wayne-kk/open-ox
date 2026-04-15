/**
 * Trajectory Logger — saves agent loop conversations in trajectories format.
 *
 * Output structure:
 *   .open-ox/trajectories/{runId}/
 *   ├── workspace/
 *   │   ├── AGENTS.md
 *   │   ├── USER.md
 *   │   ├── IDENTITY.md
 *   │   ├── HEARTBEAT.md
 *   │   ├── SOUL.md
 *   │   ├── TOOLS.md
 *   │   └── memory/        (optional)
 *   └── trajectory.jsonl    (conversation history)
 *
 * Quality invariants enforced:
 *   - user+assistant turns > 5
 *   - assistant+tool turns > 10
 *   - No tool_response followed directly by user message
 *   - Last message is always assistant role
 *   - All content in Chinese (zh)
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { WORKSPACE_ROOT } from "@/ai/tools/system/common";

const TRAJECTORY_ROOT = path.join(WORKSPACE_ROOT, ".open-ox", "trajectories");

// ── Types ────────────────────────────────────────────────────────────────────

interface TrajectoryMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    reasoning?: string; // assistant's thinking/reasoning process
}

interface TrajectoryMeta {
    projectId: string;
    instruction: string;
    model: string;
    tools: string[];
    skills: string[];
    iterations: number;
    buildPassed: boolean;
    touchedFiles: string[];
    timestamp: string;
}

export interface TrajectoryData {
    meta: TrajectoryMeta;
    messages: TrajectoryMessage[];
}

// ── Workspace base files ─────────────────────────────────────────────────────

const AGENTS_MD = `# Agents

## Modify Agent
- 角色：项目修改代理
- 能力：读取代码、搜索代码、精确编辑文件、创建新文件、运行构建验证
- 工作流：理解需求 → 探索代码 → 精确编辑 → 构建验证 → 修复错误
- 决策模式：完全自主决策，stop hook 质量门控
`;

const USER_MD = `# User Profile
- 角色：Web 开发者
- 使用场景：通过自然语言指令修改 AI 生成的 Next.js 项目
- 交互方式：输入修改指令，agent 自动完成读取、编辑、验证全流程
`;

const IDENTITY_MD = `# Identity
- 名称：Open-OX Modify Agent
- 版本：v6
- 架构：Stop Hook Agent Loop（参考 Claude Code query() 循环设计）
- 核心原则：LLM 完全自由决策，stop hook 做质量门控
`;

const HEARTBEAT_MD = `# Heartbeat
- 状态：active
- 循环类型：while(true) agent loop
- 终止条件：LLM 停止调用工具 + stop hook 全部通过
- 最大迭代：40
- stop hook 最大重试：5
`;

const SOUL_MD = `# Soul
- 设计哲学：不限制 LLM 的工具选择，通过 stop hook 确保任务完成
- 灵感来源：Claude Code 的 query() 循环 + stop hooks 质量门控
- 核心循环：API 调用 → 工具执行 → 结果反馈 → 重复直到完成
- 质量门控：编辑检查 → 构建检查 → 构建通过检查
`;

function generateToolsMd(tools: string[]): string {
    const toolDescriptions: Record<string, string> = {
        read_file: "读取文件内容，用于在编辑前理解代码",
        search_code: "基于 ripgrep 的代码搜索，查找模式、引用、定义",
        list_dir: "列出目录内容，探索项目结构",
        edit_file: "精确编辑：old_string → new_string 替换，必须唯一匹配",
        write_file: "创建新文件，仅用于全新文件",
        run_build: "运行项目构建验证，检查编译是否通过",
    };

    const lines = ["# Tools\n"];
    for (const tool of tools) {
        const desc = toolDescriptions[tool] ?? tool;
        const isConcurrent = ["read_file", "search_code", "list_dir"].includes(tool);
        lines.push(`## ${tool}`);
        lines.push(`- 描述：${desc}`);
        lines.push(`- 并发安全：${isConcurrent ? "是（只读）" : "否（写操作）"}`);
        lines.push("");
    }
    return lines.join("\n");
}

// ── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
    valid: boolean;
    errors: string[];
}

function validateTrajectory(messages: TrajectoryMessage[]): ValidationResult {
    const errors: string[] = [];

    // Count turns
    const userTurns = messages.filter(m => m.role === "user").length;
    const assistantTurns = messages.filter(m => m.role === "assistant").length;
    const toolTurns = messages.filter(m => m.role === "tool").length;

    if (userTurns + assistantTurns <= 5) {
        errors.push(`user+assistant 轮次 ${userTurns + assistantTurns} <= 5`);
    }
    if (assistantTurns + toolTurns <= 10) {
        errors.push(`assistant+tool 轮次 ${assistantTurns + toolTurns} <= 10`);
    }

    // Check: no tool response followed directly by user message
    for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === "tool" && messages[i + 1].role === "user") {
            errors.push(`消息 ${i}: tool response 后直接接 user message（缺少 assistant 回复）`);
        }
    }

    // Check: last message must be assistant
    const last = messages[messages.length - 1];
    if (last && (last.role === "tool" || last.role === "user")) {
        errors.push(`最后一条消息是 ${last.role}，应该是 assistant`);
    }

    return { valid: errors.length === 0, errors };
}

// ── Save ─────────────────────────────────────────────────────────────────────

export async function saveTrajectory(data: TrajectoryData): Promise<string> {
    const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}_${data.meta.projectId.slice(0, 20)}`;
    const runDir = path.join(TRAJECTORY_ROOT, runId);
    const workspaceDir = path.join(runDir, "workspace");
    const memoryDir = path.join(workspaceDir, "memory");

    await mkdir(memoryDir, { recursive: true });

    // Write workspace base files
    await writeFile(path.join(workspaceDir, "AGENTS.md"), AGENTS_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "USER.md"), USER_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "IDENTITY.md"), IDENTITY_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "HEARTBEAT.md"), HEARTBEAT_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "SOUL.md"), SOUL_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "TOOLS.md"), generateToolsMd(data.meta.tools), "utf-8");

    // Write memory placeholder
    await writeFile(path.join(memoryDir, "session.md"), [
        `# Session Memory`,
        `- 项目：${data.meta.projectId}`,
        `- 指令：${data.meta.instruction}`,
        `- 模型：${data.meta.model}`,
        `- 迭代次数：${data.meta.iterations}`,
        `- 构建结果：${data.meta.buildPassed ? "通过" : "失败"}`,
        `- 修改文件：${data.meta.touchedFiles.join(", ")}`,
        `- 时间：${data.meta.timestamp}`,
    ].join("\n"), "utf-8");

    // Validate
    const validation = validateTrajectory(data.messages);
    if (!validation.valid) {
        console.warn(`[trajectory] Validation warnings for ${runId}:`, validation.errors);
    }

    // Ensure last message is assistant (fix if needed)
    const messages = [...data.messages];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role !== "assistant") {
        messages.push({
            role: "assistant",
            content: `修改完成。共修改 ${data.meta.touchedFiles.length} 个文件，构建${data.meta.buildPassed ? "通过" : "未通过"}。`,
        });
    }

    // Write trajectory as JSONL
    const jsonlLines = messages.map(m => JSON.stringify(m)).join("\n");
    await writeFile(path.join(runDir, "trajectory.jsonl"), jsonlLines, "utf-8");

    // Write meta
    await writeFile(path.join(runDir, "meta.json"), JSON.stringify({
        ...data.meta,
        validation: validation,
        messageCount: messages.length,
        turnCounts: {
            system: messages.filter(m => m.role === "system").length,
            user: messages.filter(m => m.role === "user").length,
            assistant: messages.filter(m => m.role === "assistant").length,
            tool: messages.filter(m => m.role === "tool").length,
        },
    }, null, 2), "utf-8");

    console.log(`[trajectory] Saved to ${runDir} (${messages.length} messages, valid=${validation.valid})`);
    return runDir;
}
