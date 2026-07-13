"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { AgentFlowDemo } from "@/app/components/AgentFlowDemo";
import { cn } from "@/lib/utils";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_project_requirement", detail: "解析需求 · 输出最小蓝图（brief/site）", color: "text-foreground" },
  { id: "infer", label: "infer_design_intent", detail: "独立推理 · 视觉风格意图", color: "text-muted-foreground" },
  { id: "plan", label: "plan_project", detail: "蓝图细化 · 页面级纲要（无固定 section 清单）", color: "text-foreground" },
  { id: "design", label: "generate_design_system", detail: "色彩 · 字体 · 动效 · Token", color: "text-foreground" },
  { id: "pages", label: "page_implement_agent ×N", detail: "每路由工具循环实现页面与组件（无全局 Nav）", color: "text-foreground" },
  { id: "chrome", label: "chrome_optimize_agent", detail: "页面完成后一次生成全局 Nav/Footer", color: "text-muted-foreground" },
  { id: "build", label: "run_build", detail: "构建 · 类型检查 · 验证", color: "text-brand-signal" },
  { id: "repair", label: "repair_build", detail: "自动修复 · 最多 5 轮", color: "text-amber-400/90" },
];

export function PipelineDisclosure() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("landing");

  return (
    <div className="mt-8 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-2 rounded-full border border-border bg-muted/30 px-5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        aria-expanded={open}
      >
        {t("pipelineToggle")}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-10 animate-fade-up">
          <p className="mb-6 text-center text-sm text-muted-foreground">{t("pipelineHint")}</p>
          <AgentFlowDemo steps={AGENT_STEPS} />
        </div>
      ) : null}
    </div>
  );
}
