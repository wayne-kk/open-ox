/**
 * @deprecated Use architectScaffoldAgent and chromeOptimizeAgent.
 * Re-exports for backward compatibility.
 */
export {
  runArchitectScaffoldAgent as runArchitectAgent,
  ARCHITECT_SCAFFOLD_AGENT_STEP as ARCHITECT_AGENT_STEP,
  ARCHITECT_SCAFFOLD_COMPLETE as ARCHITECT_COMPLETE,
  type RunArchitectScaffoldAgentParams as RunArchitectAgentParams,
  type ArchitectScaffoldAgentResult as ArchitectAgentResult,
} from "./architectScaffoldAgent";
