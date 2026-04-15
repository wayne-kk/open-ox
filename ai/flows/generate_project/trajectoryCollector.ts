/**
 * Trajectory Collector for Generate Flow
 *
 * Collects REAL conversation history from generate_section and repair_build steps.
 * Concurrency-safe: createEpisodeCollector() returns an independent collector
 * per section, so parallel Promise.allSettled calls don't interfere.
 */

import type { ChatMessage } from "@/ai/shared/llm/types";
import { saveTrajectory } from "../modify_project/trajectory";

interface Episode {
    stepName: string;
    messages: ChatMessage[];
}

export class GenerateTrajectoryCollector {
    private episodes: Episode[] = [];
    private projectId: string;
    private userInput: string;
    private model: string;

    constructor(projectId: string, userInput: string, model: string) {
        this.projectId = projectId;
        this.userInput = userInput;
        this.model = model;
    }

    /**
     * Create an independent message collector for one step.
     * Safe to call concurrently — each collector writes to its own episode.
     */
    createEpisodeCollector(stepName: string): (msg: ChatMessage) => void {
        const episode: Episode = { stepName, messages: [] };
        // Register immediately so ordering reflects call order
        this.episodes.push(episode);
        return (msg: ChatMessage) => {
            episode.messages.push(msg);
        };
    }

    private buildUnifiedMessages(): ChatMessage[] {
        const out: ChatMessage[] = [];

        out.push({
            role: "system",
            content: [
                "你是一个 AI 网站生成代理，负责根据用户描述生成完整的 Next.js 网站。",
                "你通过多个步骤工作：分析需求、规划项目、生成设计系统、生成各组件、构建验证、自动修复。",
                "可用工具：write_file, read_file, edit_file, search_code, run_build, generate_image",
            ].join("\n"),
        });

        out.push({ role: "user", content: this.userInput });

        // Filter out empty episodes (steps where LLM didn't use tools)
        const nonEmpty = this.episodes.filter(ep => ep.messages.length > 0);

        for (const episode of nonEmpty) {
            // Transition: ensure we don't have tool→user adjacency
            const last = out[out.length - 1];
            if (last && last.role !== "assistant") {
                out.push({
                    role: "assistant",
                    content: `正在执行 ${episode.stepName}...`,
                });
            }

            // Append ALL real messages, skip per-step system prompts
            for (const msg of episode.messages) {
                if (msg.role === "system") continue;
                out.push(msg);
            }
        }

        // Ensure ends with assistant
        if (out.length > 0 && out[out.length - 1].role !== "assistant") {
            out.push({
                role: "assistant",
                content: `生成完成。共处理 ${nonEmpty.length} 个步骤。`,
            });
        }

        return out;
    }

    async save(touchedFiles: string[], buildPassed: boolean, iterations: number): Promise<string | null> {
        const nonEmpty = this.episodes.filter(ep => ep.messages.length > 0);
        if (nonEmpty.length === 0) {
            console.log("[trajectory] No episodes with messages collected, skipping");
            return null;
        }

        const totalMsgs = nonEmpty.reduce((sum, ep) => sum + ep.messages.length, 0);
        console.log(`[trajectory] Generate: ${nonEmpty.length} episodes, ${totalMsgs} raw messages`);

        const messages = this.buildUnifiedMessages();

        try {
            return await saveTrajectory({
                meta: {
                    projectId: this.projectId,
                    instruction: this.userInput,
                    model: this.model,
                    tools: ["write_file", "read_file", "edit_file", "search_code", "run_build", "generate_image"],
                    skills: [],
                    iterations,
                    buildPassed,
                    touchedFiles,
                    timestamp: new Date().toISOString(),
                },
                messages: messages.map(m => ({
                    role: m.role as "system" | "user" | "assistant" | "tool",
                    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                    tool_calls: m.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined,
                    tool_call_id: m.tool_call_id,
                })),
            });
        } catch (err) {
            console.warn("[trajectory] Generate save failed:", err);
            return null;
        }
    }
}
