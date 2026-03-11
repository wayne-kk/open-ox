/**
 * Workflow Engine - 执行 skill 链
 */

import type { FlowStep } from "../types";
import { runSkill } from "./runSkill";

export interface WorkflowResult {
  steps: Array<{ skill: string; input: unknown; output: string }>;
  finalOutput: string;
}

/**
 * 按顺序执行 flow 中的每个 skill
 * 上一步输出作为下一步输入
 */
export async function runWorkflow(
  flow: FlowStep[],
  initialInput: string
): Promise<WorkflowResult> {
  const steps: WorkflowResult["steps"] = [];
  let currentInput = initialInput;

  for (const step of flow) {
    const output = await runSkill({
      skillName: step.skill,
      input: step.input && Object.keys(step.input).length > 0
        ? { ...(step.input as Record<string, unknown>), content: currentInput }
        : currentInput,
    });

    steps.push({
      skill: step.skill,
      input: currentInput,
      output,
    });

    currentInput = output;
  }

  return {
    steps,
    finalOutput: currentInput,
  };
}
