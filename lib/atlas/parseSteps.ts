/**
 * Parse BuildStep[] into topology graph for Generation Atlas
 */

import type { BuildStep } from "@/ai";
import type { IntentAgentTurn } from "@/app/[locale]/studio/types/build-studio";
import type { GraphNode, Stage, StageId, TopologyGraph } from "./types";

const STAGE_MAP: Record<string, StageId> = {
  analyze_project_requirement: "understand",
  infer_design_intent: "understand",
  plan_project: "plan",
  match_design_system_skill: "design", // legacy build logs only — step removed
  generate_project_design_system: "design",
  apply_project_design_tokens: "design",
  architect_scaffold_agent: "compose",
  chrome_optimize_agent: "compose",
  architect_agent: "compose",
  install_dependencies: "verify",
  /** Scoped in-process tsc on generated .tsx (ENABLE_PREBUILD_TSC), before `run_build` */
  typecheck_generated: "verify",
  run_build: "verify",
  repair_build: "repair",
  mark_unvalidated_files: "verify",
  clear_validation_markers: "verify",
};

const STAGE_LABELS: Record<StageId, string> = {
  intent: "Intent",
  understand: "Understand",
  plan: "Plan",
  design: "Design",
  compose: "Compose",
  generate: "Generate",
  verify: "Verify",
  repair: "Repair",
};

function inferStage(stepName: string): StageId {
  if (stepName.startsWith("page_implement_agent:")) return "generate";
  if (stepName.startsWith("page_agent_tool:")) return "generate";
  if (
    stepName.startsWith("architect_scaffold_agent_tool:") ||
    stepName === "architect_scaffold_agent" ||
    stepName.startsWith("chrome_optimize_agent_tool:") ||
    stepName === "chrome_optimize_agent" ||
    stepName.startsWith("architect_agent_tool:") ||
    stepName === "architect_agent"
  ) {
    return "compose";
  }
  if (stepName.startsWith("intent_agent")) return "intent";
  if (stepName.startsWith("install_dependencies:")) return "verify";
  if (stepName.startsWith("typecheck_generated")) return "verify";
  if (stepName.startsWith("run_build")) return "verify";
  if (stepName.startsWith("repair_build")) return "repair";
  if (stepName.startsWith("mark_unvalidated") || stepName.startsWith("clear_validation")) return "verify";
  // Legacy section-mode steps (historical build logs)
  if (stepName.startsWith("describe_page_sections:")) return "compose";
  if (stepName.startsWith("generate_section:")) return "generate";
  if (stepName.startsWith("compose_page:")) return "compose";
  return STAGE_MAP[stepName] ?? "generate";
}

function inferKind(stepName: string, stage: StageId): GraphNode["kind"] {
  if (stage === "repair") return "repair";
  if (stage === "intent") return "intent";
  if (stepName.startsWith("typecheck_generated")) return "verification";
  if (stepName.startsWith("run_build") || stepName.startsWith("install_dependencies")) return "verification";
  if (
    stepName.startsWith("generate_section") ||
    stepName.startsWith("compose_page") ||
    stepName.startsWith("page_implement_agent:") ||
    stepName.startsWith("page_agent_tool:")
  ) {
    return "generation";
  }
  if (stepName.startsWith("describe_page_sections")) return "transform";
  if (stepName.startsWith("analyze_") || stepName.startsWith("plan_")) return "transform";
  if (stepName.startsWith("generate_project_design") || stepName.startsWith("apply_project")) return "transform";
  if (
    stepName === "architect_scaffold_agent" ||
    stepName.startsWith("architect_scaffold_agent_tool:") ||
    stepName === "chrome_optimize_agent" ||
    stepName.startsWith("chrome_optimize_agent_tool:") ||
    stepName === "architect_agent" ||
    stepName.startsWith("architect_agent_tool:")
  ) {
    return "generation";
  }
  return "transform";
}

function formatStepLabel(step: string): string {
  if (step.startsWith("describe_page_sections:")) {
    return `describe:${step.replace("describe_page_sections:", "")}`;
  }
  if (step.startsWith("generate_section:")) {
    const parts = step.replace("generate_section:", "").split(":");
    return parts.length >= 2 ? `section:${parts[0]}:${parts[1]}` : step;
  }
  if (step.startsWith("compose_page:")) {
    return `compose:${step.replace("compose_page:", "")}`;
  }
  if (step.startsWith("page_agent_tool:")) {
    // page_agent_tool:home:write_file:3 → detail carries the human-readable label
    // fallback: extract tool name from the step name
    const parts = step.replace("page_agent_tool:", "").split(":");
    const toolName = parts[1]?.replace(/_/g, " ") ?? "tool";
    return `agent ${toolName}`;
  }
  if (step.startsWith("page_implement_agent:")) {
    return `page agent:${step.replace("page_implement_agent:", "")}`;
  }
  if (step.startsWith("architect_scaffold_agent_tool:")) {
    const parts = step.replace("architect_scaffold_agent_tool:", "").split(":");
    const toolName = parts[0]?.replace(/_/g, " ") ?? "tool";
    return `layout ${toolName}`;
  }
  if (step === "architect_scaffold_agent") {
    return "chrome scaffold";
  }
  if (step.startsWith("chrome_optimize_agent_tool:")) {
    const parts = step.replace("chrome_optimize_agent_tool:", "").split(":");
    const toolName = parts[0]?.replace(/_/g, " ") ?? "tool";
    return `chrome ${toolName}`;
  }
  if (step === "chrome_optimize_agent") {
    return "chrome";
  }
  if (step.startsWith("architect_agent_tool:")) {
    const parts = step.replace("architect_agent_tool:", "").split(":");
    const toolName = parts[0]?.replace(/_/g, " ") ?? "tool";
    return `architect ${toolName}`;
  }
  if (step === "architect_agent") {
    return "architect agent";
  }
  if (step.startsWith("intent_agent")) {
    return "intent agent";
  }
  if (step.startsWith("install_dependencies:")) {
    return `install:${step.replace("install_dependencies:", "")}`;
  }
  if (step.startsWith("typecheck_generated")) {
    return "typecheck (generated .tsx)";
  }
  if (step.startsWith("run_build")) {
    const suffix = step.replace("run_build", "");
    return suffix ? `build${suffix}` : "build";
  }
  if (step.startsWith("repair_build")) {
    const num = step.match(/\d+/)?.[0] ?? "";
    return num ? `repair #${num}` : "repair";
  }
  return step.replace(/_/g, " ");
}

function extractSkillHints(step: BuildStep): string[] {
  const hints = new Set<string>();
  if (typeof step.skillId === "string" && step.skillId.trim().length > 0) {
    hints.add(step.skillId.trim());
  }
  return Array.from(hints);
}

function buildIntentNode(intentAgent: IntentAgentTurn | null | undefined, flowStart: number): GraphNode | null {
  if (!intentAgent) return null;
  const isError = intentAgent.status === "error";
  const isCommitted = intentAgent.status === "commit_generate";
  return {
    id: "intent_agent",
    step: "intent_agent",
    stage: "intent",
    kind: "intent",
    status: isError ? "error" : isCommitted ? "ok" : "active",
    detail:
      intentAgent.yieldPayload?.message ??
      intentAgent.assistantText ??
      intentAgent.errorMessage ??
      intentAgent.mergedBrief ??
      undefined,
    duration: 0,
    timestamp: flowStart || Date.now(),
    index: -1,
    trace: {
      output: {
        status: intentAgent.status,
        turnCounter: intentAgent.turnCounter,
        toolCallNames: intentAgent.toolCallNames,
        options: intentAgent.yieldPayload?.options,
        briefDraftMarkdown: intentAgent.yieldPayload?.briefDraftMarkdown,
      },
    },
  };
}

export function parseStepsToTopology(
  steps: BuildStep[],
  flowStart: number,
  options?: { intentAgent?: IntentAgentTurn | null }
): TopologyGraph {
  // Deduplicate: for each step name, keep the last entry (active gets replaced by ok/error)
  const deduped = new Map<string, { step: BuildStep; index: number }>();
  steps.forEach((s, index) => {
    deduped.set(s.step, { step: s, index });
  });

  const nodes: GraphNode[] = Array.from(deduped.values()).map(({ step: s, index }) => {
    const stage = inferStage(s.step);
    const stepWithExtra = s as { skillId?: string | null; trace?: GraphNode["trace"] };
    const skillHints = extractSkillHints(s);
    const status: GraphNode["status"] =
      s.status === "ok" ? "ok" : s.status === "active" ? "active" : "error";
    return {
      id: s.step,
      step: s.step,
      stage,
      kind: inferKind(s.step, stage),
      status,
      detail: s.detail,
      duration: s.duration,
      timestamp: s.timestamp,
      index,
      skillHint: skillHints[0] ?? (stepWithExtra.skillId ?? undefined),
      skillHints,
      trace: stepWithExtra.trace,
    };
  });
  const intentNode = buildIntentNode(options?.intentAgent, flowStart);
  if (intentNode) nodes.unshift(intentNode);
  nodes.sort((a, b) => (a.timestamp - b.timestamp) || (a.index - b.index));

  const stageOrder: StageId[] = [
    "intent",
    "understand",
    "plan",
    "design",
    "generate",
    "compose",
    "verify",
    "repair",
  ];

  const stageMap = new Map<StageId, GraphNode[]>();
  for (const node of nodes) {
    const list = stageMap.get(node.stage) ?? [];
    list.push(node);
    stageMap.set(node.stage, list);
  }

  const stages: Stage[] = stageOrder
    .filter((id) => (stageMap.get(id)?.length ?? 0) > 0)
    .map((id) => ({
      id,
      label: STAGE_LABELS[id],
      nodes: (stageMap.get(id) ?? []).sort(
        (a, b) => (a.timestamp - b.timestamp) || (a.index - b.index)
      ),
    }));

  return {
    stages,
    nodes,
    flowStart,
  };
}

export { formatStepLabel };
