/**
 * AI 共享模块 — 任何 agent 均可调用
 */

export {
  discoverSkills,
  discoverSkillsBySectionType,
  toCompactMetadata,
  loadSkillContent,
  type SkillMetadata,
  type SkillWhenCondition,
} from "./skillDiscovery";

export {
  SUBAGENT_KINDS,
  SPAWN_SUBAGENT_TOOL_NAME,
  isSubagentKind,
  registerSubagent,
  getSubagentSpec,
  listSubagentKinds,
  runSubagent,
  createSpawnSubagentTool,
  runVerifierSubagent,
  formatVerifierReport,
  MAX_SUBAGENT_DEPTH,
  type SubagentKind,
  type SubagentSpec,
  type SubagentRunInput,
  type SubagentResult,
  type SubagentHostContext,
  type RunVerifierSubagentInput,
} from "./subagent";
