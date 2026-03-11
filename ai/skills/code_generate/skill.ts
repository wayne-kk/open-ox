import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "code_generate",
  description: "Generate code for a given target (component, page, module)",
  category: "code",
  examples: [
    "生成一个 React 组件",
    "Create a Next.js page",
    "写一个工具函数",
  ],
  inputSchema: {
    target: "string - what to generate (e.g. component name, file path)",
    description: "string - requirements and context",
  },
  prompt: "code_generate/prompt.md",
  promptVersion: "v1",
  tools: [],
};
