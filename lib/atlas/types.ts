/**
 * Generation Atlas — topology graph types
 */

export type NodeStatus = "pending" | "active" | "ok" | "error";

export type NodeKind =
  | "transform"   // analyze, plan, design, compose
  | "decision"    // skill selection, dependency resolution
  | "generation"  // generate_section, compose_page
  | "verification" // build, install
  | "repair"      // repair_build
  | "terminal";  // success / failed

export type StageId =
  | "understand"
  | "plan"
  | "design"
  | "compose"
  | "generate"
  | "verify"
  | "repair";

import type { StepTrace } from "@/app/build-studio/types/build-studio";

export interface GraphNode {
  id: string;
  step: string;
  stage: StageId;
  kind: NodeKind;
  status: NodeStatus;
  detail?: string;
  duration: number;
  timestamp: number;
  index: number;
  skillHint?: string;
  trace?: StepTrace;
}

export interface Stage {
  id: StageId;
  label: string;
  nodes: GraphNode[];
}

export interface TopologyGraph {
  stages: Stage[];
  nodes: GraphNode[];
  flowStart: number;
}

export interface AtlasEvent {
  type: "step-start" | "step-complete" | "step-error" | "skill-selected";
  stepId: string;
  timestamp: number;
  detail?: string;
  skillId?: string;
  confidence?: number;
}
