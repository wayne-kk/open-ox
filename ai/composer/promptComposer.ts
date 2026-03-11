/**
 * Prompt Composer - 运行时拼装 DSL 模板
 */

import { readFileSync } from "fs";
import { join } from "path";
import { compile } from "./dslEngine";
import type { ComposeContext } from "../types";

const DSL_DIR = join(process.cwd(), "ai", "prompts", "dsl");

function loadDsl(name: string): string {
  try {
    return readFileSync(join(DSL_DIR, `${name}.md`), "utf-8");
  } catch {
    return "";
  }
}

export interface ComposeOptions {
  system?: string;
  skillPrompt?: string;
  memory?: string;
  input?: string;
  tools?: string;
  outputFormat?: string;
  /** 自定义 DSL 片段，会合并到 ctx */
  extra?: Record<string, unknown>;
}

/**
 * 组合完整 prompt
 * 支持 Handlebars 风格条件与循环
 */
export function composePrompt(ctx: ComposeContext & ComposeOptions): string {
  const system = ctx.system ?? loadDsl("system");
  const skillPrompt = ctx.skillPrompt ?? "";
  const memory = ctx.memory ?? "";
  const input = ctx.input ?? "";
  const tools = ctx.tools ?? "";
  const outputFormat = ctx.outputFormat ?? loadDsl("output_json");

  const fullCtx: ComposeContext = {
    ...ctx,
    system,
    skillPrompt,
    memory,
    input,
    tools,
    outputFormat,
  };

  const template = `{{system}}

{{skillPrompt}}

{{#if memory}}
## Relevant Memory
{{memory}}
{{/if}}

{{#if tools}}
## Available Tools
{{tools}}
{{/if}}

## Output Format
{{outputFormat}}
`;

  return compile(template, fullCtx).trim();
}

/**
 * 从预加载的 DSL 片段组合（避免重复读文件）
 */
export function composeFromParts(parts: {
  system: string;
  skillPrompt: string;
  memory?: string;
  input: string;
  tools?: string;
  outputFormat: string;
}): string {
  return composePrompt(parts);
}
