# @open-ox/sdk

用自然语言生成完整的 Next.js 项目。自包含，不依赖外部服务。

## 安装

```bash
npm install @open-ox/sdk
```

## 快速开始

```ts
import { OpenOxClient } from "@open-ox/sdk";

const client = new OpenOxClient({
  apiKey: process.env.OPENAI_API_KEY,
  outputDir: "./projects",
});

const result = await client.generate({
  prompt: "一个咖啡店的官网，包含首页、菜单和联系我们",
  onStep: (step) => console.log(`[${step.status}] ${step.step}`),
});

console.log(result.success);           // true
console.log(result.projectPath);       // ./projects/proj_xxx
console.log(result.generatedFiles);    // ["app/page.tsx", ...]
console.log(result.verificationStatus); // "passed"
```

SDK 内置了项目模板、prompt 模板和生成引擎。你只需要提供一个 OpenAI 兼容的 API Key。

## 依赖管理

生成的项目需要 `next`、`react`、`tailwind` 等依赖才能构建验证。SDK 自动处理：

**首次生成**：自动运行 `npm install`，完成后缓存 `node_modules` 到 `outputDir/_node_modules_cache/`。

**后续生成**：自动 symlink 缓存的 `node_modules`，秒级完成。

**高频使用**：预装一个模板目录，所有项目共享：

```bash
# 一次性准备
mkdir my-template && cd my-template
npm init -y
npm install next@16 react@19 react-dom@19 tailwindcss@4 @tailwindcss/postcss typescript @types/react @types/node
```

```ts
const client = new OpenOxClient({
  apiKey: "...",
  outputDir: "./projects",
  templateDir: "./my-template",  // 所有项目共享这个 node_modules
});
```

## 配置

```ts
const client = new OpenOxClient({
  // 必填
  apiKey: "sk-...",
  outputDir: "./projects",

  // 可选：LLM
  baseURL: "https://api.openai.com/v1",  // 支持任何 OpenAI 兼容网关
  model: "gpt-4o",                        // 默认模型（默认 gpt-4o-mini）

  // 可选：每个步骤用不同模型
  stepModels: {
    analyze_project_requirement: "gpt-4o",
    generate_section: "gpt-4o-mini",
    repair_build: "gpt-4o",
  },

  // 可选：推理深度
  stepThinkingLevels: {
    plan_project: "high",
  },

  // 可选：AI 图片生成（火山引擎 Ark）
  imageApiKey: "ark-...",
  imageBaseURL: "https://ark.cn-beijing.volces.com/api/v3",
  imageModel: "doubao-seedream-4-0-250828",

  // 可选：预装模板目录（跳过 npm install）
  templateDir: "./my-template",
});
```

### 可配置的步骤

| 步骤 ID | 说明 |
|---------|------|
| `analyze_project_requirement` | 需求分析，生成项目蓝图 |
| `plan_project` | 规划页面结构和组件 |
| `generate_project_design_system` | 生成设计系统 |
| `apply_project_design_tokens` | 应用设计令牌 |
| `describe_page_sections` | 页面分段设计 |
| `generate_section` | 组件代码生成 |
| `compose_page` | 页面组合 |
| `repair_build` | 构建修复 |

## generate() 参数

```ts
const result = await client.generate({
  prompt: "...",              // 必填：项目描述
  mode: "web",                // 可选："web"（默认）或 "app"
  styleGuide: "深色主题...",   // 可选：设计风格指引
  onStep: (step) => {},       // 可选：实时进度回调
});
```

## 返回值

```ts
{
  success: boolean;
  projectId: string;                     // 生成的项目 ID
  projectPath: string;                   // 项目绝对路径
  verificationStatus: "passed"|"failed"; // next build 是否通过
  generatedFiles: string[];              // 生成的文件列表
  blueprint: PlannedProjectBlueprint;    // 项目蓝图
  steps: BuildStep[];                    // 步骤执行记录
  totalDuration: number;                 // 总耗时(ms)
  error?: string;                        // 错误信息
}
```

## 构建验证与自动修复

SDK 生成代码后会自动：

1. 运行 `next build` 验证项目能否构建
2. 如果构建失败，LLM 分析错误日志并自动修复代码
3. 再次构建验证
4. 结果写入 `verificationStatus`

整个过程通过 `onStep` 回调实时推送：

```ts
onStep({ step: "run_build", status: "error", detail: "Type error in HeroSection.tsx" })
onStep({ step: "repair_build", status: "active", detail: "Fixing..." })
onStep({ step: "run_build", status: "ok", detail: "Build passed" })
```

## 输出目录结构

```
projects/proj_xxx/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/          # Header, Footer
│   └── sections/        # 页面组件
├── public/images/       # AI 生成的图片
├── design-system.md
├── tailwind.config.ts
├── package.json
└── node_modules/        # symlink 到缓存
```

## 要求

- Node.js >= 18
- OpenAI 兼容的 API Key
- npm（用于自动安装项目依赖）
