/**
 * AI Engine 核心类型定义
 */

export interface SkillMetadata {
  name: string;
  description: string;
  category: string;
  examples: string[];
  inputSchema: Record<string, string>;
  prompt: string;
  promptVersion?: string;
  tools?: string[];
}

export interface Skill extends SkillMetadata {
  promptContent?: string;
}

export interface ComposeContext {
  system?: string;
  skillPrompt?: string;
  memory?: string;
  input?: string;
  tools?: string;
  outputFormat?: string;
  [key: string]: unknown;
}

export interface RouterResult {
  skill: string;
  confidence?: number;
}

export interface FlowStep {
  skill: string;
  input?: Record<string, unknown>;
}

export interface WorkflowResult {
  steps: Array<{ skill: string; output: unknown }>;
  finalOutput: unknown;
}
