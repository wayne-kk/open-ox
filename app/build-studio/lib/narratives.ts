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
            what: "基于简报进行全站规划，确定页面结构、各区块的设计意图和交互策略。",
            output: ok
                ? "已生成完整蓝图（Blueprint），包含页面地图、布局区块、设计计划和约束条件。"
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
    if (s === "compose_layout") {
        return {
            what: "生成全局布局文件（layout.tsx），将共享 Shell 区块（如导航 HUD）组合进来。",
            output: ok
                ? "layout.tsx 已生成，全局导航和共享 Shell 已挂载。"
                : "布局文件生成失败，全局 Shell 可能缺失。",
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("compose_page_")) {
        const pageName = s.replace("compose_page_", "");
        return {
            what: `组合「${pageName}」页面，将该页面下的所有区块按顺序拼装成完整的 page.tsx。`,
            output: ok
                ? `${pageName}/page.tsx 已生成，页面区块已按规划顺序组合完毕。`
                : `${pageName} 页面组合失败，该页面可能无法正常渲染。`,
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("generate_section:") || s.startsWith("generate_section_")) {
        const sectionName = s
            .replace("generate_section:", "")
            .replace(/^generate_section_[^_]+_/, "");
        return {
            what: `生成「${sectionName}」区块组件，依据设计计划实现布局、样式和交互逻辑。`,
            output: ok
                ? `${sectionName}.tsx 已生成${step.skillId ? `，使用了 ${step.skillId} 能力模板` : ""}。`
                : `${sectionName} 区块生成失败，该区块将缺失或显示异常。`,
            note: step.detail ?? undefined,
        };
    }
    if (s.startsWith("generate_section_layout_")) {
        const sectionName = s.replace("generate_section_layout_", "");
        return {
            what: `生成全局布局区块「${sectionName}」，这是跨页面共享的 Shell 组件。`,
            output: ok
                ? `${sectionName}.tsx 已生成并挂载到全局布局。`
                : `${sectionName} 布局区块生成失败。`,
            note: step.detail ?? undefined,
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

    return {
        what: `执行步骤：${s}`,
        output: ok ? "步骤执行完成。" : "步骤执行失败。",
        note: step.detail ?? undefined,
    };
}
