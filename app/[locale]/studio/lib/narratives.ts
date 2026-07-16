import type { BuildStep } from "../types/build-studio";

export function getStepNarrative(step: BuildStep): {
    what: string;
    output: string;
    note?: string;
} {
    const s = step.step;
    const ok = step.status === "ok";

    if (s === "analyze_project_requirement") {
        return {
            what: "解析你的需求，提炼项目定位、目标用户、核心功能范围和设计风格方向。",
            output: ok
                ? "已生成项目简报（Brief），包含产品类型、受众画像、能力清单和体验关键词。"
                : "需求解析失败，无法继续后续规划。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "plan_project") {
        return {
            what: "基于简报进行全站规划，确定页面地图与各页的设计纲要（不再输出固定 section 文件清单）。",
            output: ok
                ? "已生成完整蓝图（Blueprint），包含页面地图、各页 pageDesignPlan 与约束条件。"
                : "规划阶段失败，蓝图未能生成。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "generate_project_design_system") {
        return {
            what: "根据设计意图生成项目专属的设计系统，包括色彩、字体、间距和组件规范。",
            output: ok
                ? "设计系统文档已生成，后续所有区块将遵循此规范保持视觉一致性。"
                : "设计系统生成失败，区块样式可能不一致。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "apply_project_design_tokens") {
        return {
            what: "将设计系统的 Token（颜色变量、字体变量等）写入全局 CSS，使整站样式生效。",
            output: ok
                ? "globals.css 已更新，设计 Token 已注入，主题色和字体规范已就位。"
                : "Token 注入失败，全局样式可能未生效。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "clear_template") {
        return {
            what: "清理 Next.js 模板的默认内容，为生成的页面腾出干净的起点。",
            output: ok ? "模板已清空，默认页面和样式已移除。" : "模板清理失败，可能存在残留内容干扰。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "architect_scaffold_agent") {
        return {
            what: "Chrome Scaffold：先落真实全局壳（layout + components/chrome），页面再填内容。",
            output: ok
                ? "全局 chrome 骨架已就绪，可预览导航；页面 Agent 开始只写内容区。"
                : "Chrome Scaffold 失败。",
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("architect_scaffold_agent_tool:")) {
        return {
            what: "Chrome Scaffold 工具调用",
            output: step.detail ?? "tool executed",
        };
    }
    if (s === "chrome_optimize_agent") {
        return {
            what: "Chrome polish：按真实路由/锚点校正 Nav/Footer 链接（不换壳）。",
            output: ok
                ? "全局 chrome 链接已校正。"
                : "Chrome polish 失败，导航链接可能仍为占位。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "shared_contract_stubs") {
        return {
            what: "串行写入 list/detail 共享组件 stub，避免并行页抢写同一卡片。",
            output: ok ? "共享契约 stub 已落盘。" : "共享 stub 写入失败。",
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("chrome_optimize_agent_tool:")) {
        return {
            what: "Chrome Agent 工具调用",
            output: step.detail ?? "tool executed",
        };
    }
    if (s === "architect_agent") {
        return {
            what: "（旧步骤）站点架构 Agent",
            output: step.detail ?? (ok ? "completed" : "failed"),
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("architect_agent_tool:")) {
        return {
            what: "（旧步骤）Architect Agent 工具调用",
            output: step.detail ?? "tool executed",
        };
    }
    if (s === "install_dependencies_generated") {
        return {
            what: "扫描所有生成文件中的 import，自动检测并安装缺失的 npm 依赖包。",
            output: ok
                ? "依赖安装完成，所有生成代码所需的第三方包已就位。"
                : "部分依赖安装失败，相关组件可能无法正常运行。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "verify_build") {
        return {
            what: "执行 next build 验证整站是否能正常编译，检查类型错误和构建问题。",
            output: ok
                ? "构建验证通过，所有页面和组件均可正常编译。"
                : "构建验证失败，存在编译错误需要修复。",
            note: step.detail ?? undefined,
        };
    }
    if (s === "repair_build") {
        return {
            what: "检测到构建错误，AI 正在自动分析错误信息并尝试修复有问题的文件。",
            output: ok ? "修复完成，构建错误已解决。" : "自动修复未能完全解决问题，可能需要手动介入。",
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("page_implement_agent:")) {
        const slug = s.replace("page_implement_agent:", "");
        return {
            what: `Page Agent 正在实现「${slug}」路由，自主探索项目结构并生成页面与组件代码。`,
            output: ok
                ? `${slug} 页面已由 Agent 完成实现。`
                : `${slug} 页面 Agent 实现失败。`,
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("page_agent_tool:")) {
        return {
            what: "Page Agent 工具调用",
            output: step.detail ?? "tool executed",
        };
    }

    return {
        what: `执行步骤：${s}`,
        output: ok ? "步骤执行完成。" : "步骤执行失败。",
        note: step.detail ?? undefined,
    };
}

/** Short chapter-style title for Studio generate progress (onboarding theater v0.1). */
export function getStepChapterTitle(stepName: string): string | null {
    if (stepName.startsWith("tool_call:") || stepName.startsWith("page_agent_tool:")) return null;
    if (stepName.startsWith("architect_scaffold_agent_tool:")) return null;
    if (stepName.startsWith("chrome_optimize_agent_tool:")) return null;
    if (stepName.startsWith("architect_agent_tool:")) return null;

    const chapters: Record<string, string> = {
        analyze_project_requirement: "① 理解需求",
        plan_project: "② 规划站点",
        generate_project_design_system: "③ 设计系统",
        apply_project_design_tokens: "③ 注入设计 Token",
        clear_template: "④ 清理模板",
        architect_scaffold_agent: "④ 搭建页面骨架",
        chrome_optimize_agent: "④ 校正导航",
        shared_contract_stubs: "④ 共享组件",
        architect_agent: "④ 站点架构",
        install_dependencies_generated: "⑤ 安装依赖",
        verify_build: "⑥ 构建验证",
        repair_build: "⑥ 自动修复",
    };

    if (chapters[stepName]) return chapters[stepName]!;
    if (stepName.startsWith("page_implement_agent:")) {
        const slug = stepName.replace("page_implement_agent:", "");
        return `⑤ 实现页面 · ${slug}`;
    }
    return null;
}
