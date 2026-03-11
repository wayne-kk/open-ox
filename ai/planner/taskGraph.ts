/**
 * Task Graph - DAG 任务图与拓扑排序
 */

import type { TaskNode, TaskGraph as TaskGraphType, ArchitectureNode } from "./types";

/**
 * 从架构规划生成任务图
 */
export function buildTaskGraphFromArchitecture(
  plan: { nodes: ArchitectureNode[] },
  options?: { defaultSkill?: string }
): TaskGraphType {
  const tasks: TaskNode[] = plan.nodes.map((node) => ({
    id: `task-${node.id}`,
    type: "generate",
    skill: options?.defaultSkill ?? "code_generate",
    input: { target: node.name, description: node.description, meta: node.meta },
    dependsOn: (node.dependsOn ?? []).map((d) => `task-${d}`),
    architectureNodeId: node.id,
    status: "pending",
  }));

  const executionOrder = topologicalSort(tasks);
  return { tasks, executionOrder };
}

/**
 * 拓扑排序，返回可执行顺序
 */
export function topologicalSort(tasks: TaskNode[]): string[] {
  const inDegree = new Map<string, number>();
  for (const t of tasks) {
    inDegree.set(t.id, t.dependsOn.length);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of tasks) {
      if (t.dependsOn.includes(id)) {
        const newDeg = (inDegree.get(t.id) ?? 0) - 1;
        inDegree.set(t.id, newDeg);
        if (newDeg === 0) queue.push(t.id);
      }
    }
  }

  return order;
}

/**
 * 获取可执行的任务（依赖已全部完成）
 */
export function getRunnableTasks(
  graph: TaskGraphType,
  doneIds: Set<string>
): TaskNode[] {
  return graph.tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.dependsOn.every((d) => doneIds.has(d))
  );
}
