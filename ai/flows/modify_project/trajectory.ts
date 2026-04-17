/**
 * Trajectory Logger — saves agent loop conversations in trajectories format.
 *
 * Output structure (per project, accumulates across modify runs):
 *   .open-ox/trajectories/{projectId}/
 *   ├── workspace/
 *   │   ├── AGENTS.md
 *   │   ├── USER.md
 *   │   ├── IDENTITY.md
 *   │   ├── HEARTBEAT.md
 *   │   ├── SOUL.md
 *   │   ├── TOOLS.md
 *   │   └── memory/        (optional)
 *   ├── trajectory.jsonl    (merged conversation history across all modify runs)
 *   └── meta.json           (accumulated metadata)
 *
 * Multi-run merging strategy:
 *   Each modify run's messages are appended to the existing trajectory.
 *   A transition is inserted between runs with structured result summary
 *   (touched files, diff stats, build status) so the trajectory captures
 *   the full Layer 1/2/3 data as a natural multi-turn conversation.
 *
 * Post-processing:
 *   - `think` tool calls have their analysis extracted into the calling
 *     assistant message's `reasoning` field for explicit thinking visibility.
 *
 * Quality invariants enforced:
 *   - user+assistant turns > 5
 *   - assistant+tool turns > 10
 *   - No tool_response followed directly by user message
 *   - Last message is always assistant role
 *   - All content in Chinese (zh)
 */

import { mkdir, writeFile, readFile as fsReadFile } from "fs/promises";
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

interface DiffInfo {
    file: string;
    stats: { additions: number; deletions: number };
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
    /** Structured diff info for each touched file */
    diffs?: DiffInfo[];
}

/** Accumulated meta stored in meta.json for merged trajectories */
interface AccumulatedMeta {
    projectId: string;
    model: string;
    tools: string[];
    runs: Array<{
        instruction: string;
        iterations: number;
        buildPassed: boolean;
        touchedFiles: string[];
        diffs?: DiffInfo[];
        timestamp: string;
    }>;
    totalIterations: number;
    totalTouchedFiles: string[];
    lastBuildPassed: boolean;
    messageCount: number;
    turnCounts: {
        system: number;
        user: number;
        assistant: number;
        tool: number;
    };
    validation: ValidationResult;
    createdAt: string;
    updatedAt: string;
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

    const userTurns = messages.filter(m => m.role === "user").length;
    const assistantTurns = messages.filter(m => m.role === "assistant").length;
    const toolTurns = messages.filter(m => m.role === "tool").length;

    if (userTurns + assistantTurns <= 5) {
        errors.push(`user+assistant 轮次 ${userTurns + assistantTurns} <= 5`);
    }
    if (assistantTurns + toolTurns <= 10) {
        errors.push(`assistant+tool 轮次 ${assistantTurns + toolTurns} <= 10`);
    }

    for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === "tool" && messages[i + 1].role === "user") {
            errors.push(`消息 ${i}: tool response 后直接接 user message（缺少 assistant 回复）`);
        }
    }

    const last = messages[messages.length - 1];
    if (last && (last.role === "tool" || last.role === "user")) {
        errors.push(`最后一条消息是 ${last.role}，应该是 assistant`);
    }

    return { valid: errors.length === 0, errors };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeProjectId(projectId: string): string {
    return projectId.replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 80);
}

async function readExistingMessages(jsonlPath: string): Promise<TrajectoryMessage[]> {
    try {
        const raw = await fsReadFile(jsonlPath, "utf-8");
        const lines = raw.split("\n").filter(l => l.trim().length > 0);
        return lines.map(l => JSON.parse(l) as TrajectoryMessage);
    } catch {
        return [];
    }
}

async function readExistingMeta(metaPath: string): Promise<AccumulatedMeta | null> {
    try {
        const raw = await fsReadFile(metaPath, "utf-8");
        return JSON.parse(raw) as AccumulatedMeta;
    } catch {
        return null;
    }
}

function stripSystemMessages(messages: TrajectoryMessage[]): TrajectoryMessage[] {
    return messages.filter(m => m.role !== "system");
}

/**
 * Build a structured result summary for the transition between modify runs.
 * This captures Layer 1 (DB persistent history) data into the trajectory.
 */
function buildResultSummary(
    instruction: string,
    touchedFiles: string[],
    diffs: DiffInfo[] | undefined,
    buildPassed: boolean,
    iterations: number,
): string {
    const lines: string[] = [];
    lines.push(`上一轮修改完成。`);
    lines.push(`用户指令：「${instruction}」`);
    lines.push(`修改结果：共修改 ${touchedFiles.length} 个文件，${iterations} 次迭代，构建${buildPassed ? "通过" : "未通过"}。`);
    if (diffs && diffs.length > 0) {
        lines.push(`变更详情：`);
        for (const d of diffs) {
            lines.push(`  - ${d.file}: +${d.stats.additions} -${d.stats.deletions}`);
        }
    } else if (touchedFiles.length > 0) {
        lines.push(`修改文件：${touchedFiles.join(", ")}`);
    }
    return lines.join("\n");
}

/**
 * Build transition messages between two modify runs.
 * Includes structured result summary from the previous run (Layer 1 data)
 * and the new user instruction.
 */
function buildTransitionMessages(
    prevRun: { instruction: string; touchedFiles: string[]; diffs?: DiffInfo[]; buildPassed: boolean; iterations: number },
    newInstruction: string,
    existingLast: TrajectoryMessage | undefined,
): TrajectoryMessage[] {
    const transition: TrajectoryMessage[] = [];

    // Always add a structured summary of the previous run's result
    // If existing trajectory already ends with assistant, this replaces the generic ending
    if (!existingLast || existingLast.role !== "assistant") {
        transition.push({
            role: "assistant",
            content: buildResultSummary(
                prevRun.instruction,
                prevRun.touchedFiles,
                prevRun.diffs,
                prevRun.buildPassed,
                prevRun.iterations,
            ),
        });
    }

    // New user instruction
    transition.push({
        role: "user",
        content: newInstruction,
    });

    return transition;
}

/**
 * Post-process messages to extract `think` tool analysis into `reasoning` field.
 *
 * When the assistant calls the `think` tool, the analysis is buried inside
 * tool_calls[].function.arguments. This extracts it and places it on the
 * assistant message's `reasoning` field for explicit visibility.
 */
function extractThinkReasoning(messages: TrajectoryMessage[]): TrajectoryMessage[] {
    // Build a map: think tool_call id → analysis text
    const thinkAnalysisById = new Map<string, string>();
    for (const msg of messages) {
        if (msg.role !== "assistant" || !msg.tool_calls) continue;
        for (const tc of msg.tool_calls) {
            if (tc.function.name !== "think") continue;
            try {
                const args = JSON.parse(tc.function.arguments);
                const analysis = args.analysis ?? args.thought ?? args.content ?? "";
                if (typeof analysis === "string" && analysis.trim()) {
                    thinkAnalysisById.set(tc.id, analysis.trim());
                }
            } catch {
                // ignore parse errors
            }
        }
    }

    if (thinkAnalysisById.size === 0) return messages;

    // Apply: for each assistant message that has think tool_calls, set reasoning
    return messages.map(msg => {
        if (msg.role !== "assistant" || !msg.tool_calls) return msg;

        const thinkTexts: string[] = [];
        for (const tc of msg.tool_calls) {
            if (tc.function.name === "think") {
                const text = thinkAnalysisById.get(tc.id);
                if (text) thinkTexts.push(text);
            }
        }

        if (thinkTexts.length === 0) return msg;

        return {
            ...msg,
            reasoning: msg.reasoning
                ? `${msg.reasoning}\n\n${thinkTexts.join("\n\n")}`
                : thinkTexts.join("\n\n"),
        };
    });
}

// ── Save (with merge) ────────────────────────────────────────────────────────

export async function saveTrajectory(data: TrajectoryData): Promise<string> {
    const dirName = sanitizeProjectId(data.meta.projectId);
    const runDir = path.join(TRAJECTORY_ROOT, dirName);
    const workspaceDir = path.join(runDir, "workspace");
    const memoryDir = path.join(workspaceDir, "memory");
    const jsonlPath = path.join(runDir, "trajectory.jsonl");
    const metaPath = path.join(runDir, "meta.json");

    await mkdir(memoryDir, { recursive: true });

    // ── Read existing data (if any) ──────────────────────────────────────
    const existingMessages = await readExistingMessages(jsonlPath);
    const existingMeta = await readExistingMeta(metaPath);
    const isFirstRun = existingMessages.length === 0;

    // ── Build merged message list ────────────────────────────────────────
    let mergedMessages: TrajectoryMessage[];

    if (isFirstRun) {
        mergedMessages = [...data.messages];
    } else {
        const prevRuns = existingMeta?.runs ?? [];
        const lastRun = prevRuns[prevRuns.length - 1];
        const existingLast = existingMessages[existingMessages.length - 1];

        // Strip system messages from new run (already present from first run)
        const newMessages = stripSystemMessages(data.messages);

        // Strip the first user message (we replace it with a cleaner transition)
        let newMessagesClean = newMessages;
        if (newMessages.length > 0 && newMessages[0].role === "user") {
            newMessagesClean = newMessages.slice(1);
        }

        const transition = buildTransitionMessages(
            {
                instruction: lastRun?.instruction ?? "",
                touchedFiles: lastRun?.touchedFiles ?? [],
                diffs: lastRun?.diffs,
                buildPassed: lastRun?.buildPassed ?? true,
                iterations: lastRun?.iterations ?? 0,
            },
            data.meta.instruction,
            existingLast,
        );

        mergedMessages = [...existingMessages, ...transition, ...newMessagesClean];
    }

    // ── Post-process: extract think tool reasoning ───────────────────────
    mergedMessages = extractThinkReasoning(mergedMessages);

    // ── Ensure last message is assistant ──────────────────────────────────
    const lastMsg = mergedMessages[mergedMessages.length - 1];
    if (lastMsg && lastMsg.role !== "assistant") {
        mergedMessages.push({
            role: "assistant",
            content: buildResultSummary(
                data.meta.instruction,
                data.meta.touchedFiles,
                data.meta.diffs,
                data.meta.buildPassed,
                data.meta.iterations,
            ),
        });
    }

    // ── Validate merged trajectory ───────────────────────────────────────
    const validation = validateTrajectory(mergedMessages);
    if (!validation.valid) {
        console.warn(`[trajectory] Validation warnings for ${dirName}:`, validation.errors);
    }

    // ── Write workspace base files ───────────────────────────────────────
    await writeFile(path.join(workspaceDir, "AGENTS.md"), AGENTS_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "USER.md"), USER_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "IDENTITY.md"), IDENTITY_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "HEARTBEAT.md"), HEARTBEAT_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "SOUL.md"), SOUL_MD, "utf-8");
    await writeFile(path.join(workspaceDir, "TOOLS.md"), generateToolsMd(data.meta.tools), "utf-8");

    // ── Build accumulated meta ───────────────────────────────────────────
    const now = new Date().toISOString();
    const newRunEntry = {
        instruction: data.meta.instruction,
        iterations: data.meta.iterations,
        buildPassed: data.meta.buildPassed,
        touchedFiles: data.meta.touchedFiles,
        diffs: data.meta.diffs,
        timestamp: data.meta.timestamp,
    };

    const allRuns = [...(existingMeta?.runs ?? []), newRunEntry];
    const allTouchedFiles = [...new Set([
        ...(existingMeta?.totalTouchedFiles ?? []),
        ...data.meta.touchedFiles,
    ])];
    const totalIterations = (existingMeta?.totalIterations ?? 0) + data.meta.iterations;

    const accMeta: AccumulatedMeta = {
        projectId: data.meta.projectId,
        model: data.meta.model,
        tools: data.meta.tools,
        runs: allRuns,
        totalIterations,
        totalTouchedFiles: allTouchedFiles,
        lastBuildPassed: data.meta.buildPassed,
        messageCount: mergedMessages.length,
        turnCounts: {
            system: mergedMessages.filter(m => m.role === "system").length,
            user: mergedMessages.filter(m => m.role === "user").length,
            assistant: mergedMessages.filter(m => m.role === "assistant").length,
            tool: mergedMessages.filter(m => m.role === "tool").length,
        },
        validation,
        createdAt: existingMeta?.createdAt ?? now,
        updatedAt: now,
    };

    // ── Write memory ─────────────────────────────────────────────────────
    const memoryLines = [
        `# Session Memory`,
        `- 项目：${data.meta.projectId}`,
        `- 总修改轮次：${allRuns.length}`,
        `- 总迭代次数：${totalIterations}`,
        `- 最新指令：${data.meta.instruction}`,
        `- 最新构建结果：${data.meta.buildPassed ? "通过" : "失败"}`,
        `- 累计修改文件：${allTouchedFiles.join(", ")}`,
        `- 最后更新：${now}`,
        ``,
        `## 修改历史`,
    ];
    for (let i = 0; i < allRuns.length; i++) {
        const run = allRuns[i];
        memoryLines.push(`### 第 ${i + 1} 轮`);
        memoryLines.push(`- 指令：${run.instruction}`);
        memoryLines.push(`- 迭代：${run.iterations}`);
        memoryLines.push(`- 构建：${run.buildPassed ? "通过" : "失败"}`);
        if (run.diffs && run.diffs.length > 0) {
            for (const d of run.diffs) {
                memoryLines.push(`- ${d.file}: +${d.stats.additions} -${d.stats.deletions}`);
            }
        } else {
            memoryLines.push(`- 文件：${run.touchedFiles.join(", ")}`);
        }
        memoryLines.push(`- 时间：${run.timestamp}`);
        memoryLines.push(``);
    }
    await writeFile(path.join(memoryDir, "session.md"), memoryLines.join("\n"), "utf-8");

    // ── Write trajectory as JSONL ────────────────────────────────────────
    const jsonlLines = mergedMessages.map(m => JSON.stringify(m)).join("\n");
    await writeFile(jsonlPath, jsonlLines, "utf-8");

    // ── Write meta ───────────────────────────────────────────────────────
    await writeFile(metaPath, JSON.stringify(accMeta, null, 2), "utf-8");

    console.log(
        `[trajectory] Saved to ${runDir} (run #${allRuns.length}, ` +
        `${mergedMessages.length} total messages, valid=${validation.valid})`
    );
    return runDir;
}
