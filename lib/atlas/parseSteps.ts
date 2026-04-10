/**
 * Parse BuildStep[] into topology graph for Generation Atlas
 */

import type { BuildStep } from "@/ai";
import type { GraphNode, Stage, StageId, TopologyGraph } from "./types";

const STAGE_MAP: Record<string, StageId> = {
  analyze_project_requirement: "understand",
  infer_design_intent: "understand",
  plan_project: "plan",
  generate_project_design_system: "design",
  apply_project_design_tokens: "design",
  compose_layout: "compose",
  compose_page: "compose",
  generate_section: "generate",
  install_dependencies: "verify",
  run_build: "verify",
  repair_build: "repair",
  mark_unvalidated_files: "verify",
  clear_validation_markers: "verify",
};

const STAGE_LABELS: Record<StageId, string> = {
  understand: "Understand",
  plan: "Plan",
  design: "Design",
  compose: "Compose",
  generate: "Generate",
  verify: "Verify",
  repair: "Repair",
};

function inferStage(stepName: string): StageId {
  if (stepName.startsWith("generate_section:")) return "generate";
  if (stepName.startsWith("compose_page:")) return "compose";
  if (stepName.startsWith("install_dependencies:")) return "verify";
  if (stepName.startsWith("run_build")) return "verify";
  if (stepName.startsWith("repair_build")) return "repair";
  if (stepName.startsWith("mark_unvalidated") || stepName.startsWith("clear_validation")) return "verify";
  return STAGE_MAP[stepName] ?? "generate";
}

function inferKind(stepName: string, stage: StageId): GraphNode["kind"] {
  if (stage === "repair") return "repair";
  if (stepName.startsWith("run_build") || stepName.startsWith("install_dependencies")) return "verification";
  if (stepName.startsWith("generate_section") || stepName.startsWith("compose_page")) return "generation";
  if (stepName.startsWith("analyze_") || stepName.startsWith("plan_")) return "transform";
  if (stepName.startsWith("generate_project_design") || stepName.startsWith("apply_project")) return "transform";
  if (stepName.startsWith("compose_layout")) return "transform";
  return "transform";
}

function formatStepLabel(step: string): string {
  if (step.startsWith("generate_section:")) {
    const parts = step.replace("generate_section:", "").split(":");
    return parts.length >= 2 ? `section:${parts[0]}:${parts[1]}` : step;
  }
  if (step.startsWith("compose_page:")) {
    return `compose:${step.replace("compose_page:", "")}`;
  }
  if (step.startsWith("install_dependencies:")) {
    return `install:${step.replace("install_dependencies:", "")}`;
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

export function parseStepsToTopology(steps: BuildStep[], flowStart: number): TopologyGraph {
  // Deduplicate: for each step name, keep the last entry (active gets replaced by ok/error)
  const deduped = new Map<string, { step: BuildStep; index: number }>();
  steps.forEach((s, index) => {
    deduped.set(s.step, { step: s, index });
  });

  const nodes: GraphNode[] = Array.from(deduped.values()).map(({ step: s, index }) => {
    const stage = inferStage(s.step);
    const stepWithExtra = s as { skillId?: string | null; trace?: GraphNode["trace"] };
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
      skillHint: stepWithExtra.skillId ?? undefined,
      trace: stepWithExtra.trace,
    };
  });
  nodes.sort((a, b) => (a.timestamp - b.timestamp) || (a.index - b.index));

  const stageOrder: StageId[] = [
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
