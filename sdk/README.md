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

就这么多。SDK 内置了项目模板、prompt 模板和生成引擎，你只需要提供一个 OpenAI 兼容的 API Key。

## 配置

```ts
const client = new OpenOxClient({
  // 必填
  apiKey: "sk-...",
  outputDir: "./projects",

  // 可选
  baseURL: "https://api.openai.com/v1",  // 支持任何 OpenAI 兼容网关
  model: "gpt-4o",                        // 默认模型（默认 gpt-4o-mini）

  // 可选：每个步骤用不同模型
  stepModels: {
    analyze_project_requirement: "gpt-4o",     // 需求分析用强模型
    generate_section: "gpt-4o-mini",           // 组件生成用快模型
    repair_build: "gpt-4o",                    // 修复用强模型
  },

  // 可选：推理深度（支持 thinking 的模型）
  stepThinkingLevels: {
    plan_project: "high",
  },
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
interface GenerateProjectResult {
  success: boolean;
  projectId: string;                     // 生成的项目 ID
  projectPath: string;                   // 项目绝对路径
  verificationStatus: "passed"|"failed"; // 构建是否通过
  generatedFiles: string[];              // 生成的文件列表
  blueprint: PlannedProjectBlueprint;    // 项目蓝图
  steps: BuildStep[];                    // 步骤执行记录
  totalDuration: number;                 // 总耗时(ms)
  error?: string;                        // 错误信息
}
```

## 实时进度

```ts
client.generate({
  prompt: "...",
  onStep: (step) => {
    // step.step     = "analyze_project_requirement"
    // step.status   = "ok" | "error" | "active"
    // step.duration = 3200 (ms)
    // step.detail   = "3 pages, 12 sections"
  },
});
```

## 输出目录结构

生成的项目是一个完整的 Next.js 项目：

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
└── package.json
```

生成完成后，进入目录安装依赖即可运行：

```bash
cd projects/proj_xxx
npm install
npm run dev
```

## Python 使用

SDK 是 Node.js 包，Python 可以通过子进程调用：

```python
import subprocess, json

result = subprocess.run(
    ["node", "-e", """
    const { OpenOxClient } = require("@open-ox/sdk");
    const client = new OpenOxClient({
      apiKey: process.env.OPENAI_API_KEY,
      outputDir: "./projects",
    });
    client.generate({ prompt: "A coffee shop website" })
      .then(r => console.log(JSON.stringify(r)))
      .catch(e => console.error(e));
    """],
    capture_output=True, text=True
)
print(json.loads(result.stdout))
```

## 要求

- Node.js >= 18
- OpenAI 兼容的 API Key
