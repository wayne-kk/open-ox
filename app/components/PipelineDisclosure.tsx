"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { AgentFlowDemo } from "@/app/components/AgentFlowDemo";
import { cn } from "@/lib/utils";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_project_requirement", color: "text-foreground" },
  { id: "infer", label: "infer_design_intent", color: "text-muted-foreground" },
  { id: "plan", label: "plan_project", color: "text-foreground" },
  { id: "design", label: "generate_design_system", color: "text-foreground" },
  { id: "pages", label: "page_implement_agent ×N", color: "text-foreground" },
  { id: "chrome", label: "chrome_optimize_agent", color: "text-muted-foreground" },
  { id: "build", label: "run_build", color: "text-brand-signal" },
  { id: "repair", label: "repair_build", color: "text-amber-400/90" },
] as const;

export function PipelineDisclosure() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("landing");
  const localizedSteps = AGENT_STEPS.map((step) => ({
    ...step,
    detail: t(`pipelineSteps.${step.id}`),
  }));

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
          <AgentFlowDemo steps={localizedSteps} />
        </div>
      ) : null}
    </div>
  );
}
