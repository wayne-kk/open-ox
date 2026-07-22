Open-OX Studio — 技术架构与实现详解
面向公开演讲版本 · 2026

第一章：产品定位与核心命题

1.1 我们在解决什么问题

传统建站工具（Webflow、Framer、WordPress）要求用户具备设计感知和操作技能。AI 聊天工具（ChatGPT、Claude）可以生成代码片段，但无法交付一个完整的、可运行的网站。

Open-OX Studio 的命题：用户只需一句话描述，系统自动完成从需求理解、设计系统生成、组件编写、构建验证到预览部署的全链路，交付物是真实可运行的 Next.js 网站，而不是代码片段。

这个命题有三个关键约束：

- 交付物必须是真实可构建的代码，而不是 mock 或截图
- 生成过程对用户完全透明，每一步实时可见
- 用户可以在生成完成后继续用自然语言迭代修改

1.2 核心指标

指标	数值
端到端生成时间	~90 秒
并行 AI Agent 数量	最多 7+ 个（section 并行生成）
用户需要写的代码行数	0
构建自动修复轮次	最多 5 轮
LLM 请求超时上限	300 秒
修改 Agent 最大迭代次数	100 次
对话记忆保留轮次	最近 10 轮
第二章：技术栈选型

2.1 主应用

层次	技术	选型理由
框架	Next.js 16 App Router	SSR + API Routes 合一，无需独立后端
语言	TypeScript 严格模式	AI 生成代码的类型安全是质量保障
样式	Tailwind CSS v4 + shadcn/ui (radix-nova)	CSS 变量驱动的主题系统，AI 可直接操作
数据库	Supabase (PostgreSQL)	托管 Postgres + 实时订阅 + Storage
预览沙箱	E2B / Storage 静态导出 / 本地 dev	默认开发环境在具备 Supabase 配置时对齐 Storage 预览；可选 E2B 或强制 local next dev
LLM	OpenAI-compatible API	支持 Gemini、GPT、任意兼容模型

2.2 为什么用原生 fetch 而非 OpenAI SDK

这是一个关键的工程决策。OpenAI 官方 SDK 内部使用 agentkeepalive，其默认 socket timeout 为 8 秒。Section 生成单次 LLM 调用可达 60 秒，会被 SDK 强制断连。

```typescript
// 我们的实现：原生 fetch，统一 300s 超时
const res = await fetch(`${baseURL}/chat/completions`, {
  method: "POST",
  body: JSON.stringify({ model, messages, tools }),
  signal: AbortSignal.timeout(300_000),  // 5分钟，覆盖所有场景
});
```

这个决策还带来了一个额外好处：可以无缝切换任何 OpenAI-compatible 的模型提供商（Gemini、Anthropic via proxy、本地 Ollama 等），只需修改 baseURL 和 model 字段。
第三章：系统整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                     用户浏览器                                    │
│                                                                  │
│  首页 (HeroPrompt)  →  /studio/[projectId]  →  /projects        │
│       ↓ POST /api/projects          ↑ 3s 轮询 / SSE 实时流       │
└──────────────────────────────────────────────────────────────────┘
                    │                        ↑
                    ▼                        │ SSE events
┌──────────────────────────────────────────────────────────────────┐
│                  Next.js API Routes                              │
│                                                                  │
│  POST /api/projects              → 创建 DB record，返回 projectId│
│  POST /api/ai                    → 启动生成流（SSE）             │
│  POST /api/projects/[id]/modify  → 启动修改流（SSE）             │
│  POST /api/projects/[id]/preview → 预览（local / storage / e2b） │
│  PUT  /api/projects/[id]/preview → 重建预览（修改后触发）        │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────────────┐
│  Supabase DB │   │   AI Pipeline    │   │  Preview runtime            │
│  + Storage   │   │                  │   │  Storage `/site-previews` │
│  projects    │   │  generate_project│   │  或 local next dev          │
│  model_configs│  │  modify_project  │   │  或 E2B static export       │
│  buckets:    │   │  shared/llm      │   │  + serve                     │
│  project-files│   │                  │   │                             │
│  site-previews   │                  │   │                             │
└──────────────┘   └──────────────────┘   └─────────────────────────────┘
```

3.1 用户创建项目的完整流程

```
1. 用户在首页输入 prompt，点击 Build
2. 前端 POST /api/projects → 立即创建 DB record (status=generating)
3. 服务端返回 projectId（毫秒级）
4. 前端跳转 /studio/{projectId}
5. 页面加载，检测 status=generating 且 buildSteps 为空
6. 自动触发 POST /api/ai，传入 projectId
7. 服务端开始 AI pipeline，每个 step 完成后：
   a. 通过 SSE 推送到前端（实时显示）
   b. 写入 Supabase DB（持久化，支持断线重连）
8. 生成完成，status 更新为 ready/failed
```

关键设计：projectId 在 AI 开始之前就已存在。用户可以随时关闭页面，重新进入时通过轮询 DB 恢复进度。

3.2 项目 ID 的格式

projectId 采用 `{timestamp}_{slug}` 格式，例如 `1743750000000_saas-landing-page`。这个设计有两个好处：

- 时间戳保证全局唯一，无需 UUID 生成器
- slug 来自 blueprint.projectTitle，URL 可读性好，用户一眼能认出是哪个项目

第四章：AI 生成 Pipeline 详解

4.1 完整的生成步骤（主路径）

```
Step 0:  validate_skill_prompts          ← 启动前校验技能 Markdown frontmatter
Step 1:  project_intent_guide           ← 可选（默认开启）；可提前结束并返回引导（不进入生成）
Step 2:  analyze_project_requirement    ← LLM + web_search ∥
Step 3:  infer_design_intent             ← LLM（风格 / 技术关键词，与 Step 2 并行）
Step 4:  plan_project                    ← LLM
Step 5:  resolve_design_system           ← Skill 快路径；未命中时才由 LLM 生成
Step 6:  apply_project_design_tokens     ← LLM：design-system + 当前 globals → 完整 globals.css（须先于 Agent）
Step 7:  architect_scaffold_agent        ← chrome-first：真实壳 app/layout.tsx + components/chrome/**
Step 7b: shared_contract_stubs（可选）   ← list/detail 共享组件串行预写
Step 8:  page_implement_agent × M        ← 每页并行；只写内容区（禁写 chrome）
Step 9:  chrome_optimize_agent          ← link polish：按真实路由/锚点校正 href（不换壳）
Step 10: await_images ∥ install_dependencies ← 等生图落盘 + npm 依赖扫描安装（并行）
Step 11: typecheck_generated             ← 默认开启：生成范围内 TS 诊断（DISABLE_PREBUILD_TSC=1 跳过）
Step 12: run_build                       ← next build（内含 TS code-fix 重试内循环）
Step 13: repair_build × 0–5             ← 构建仍失败则 Agent 增量修复（最多 5 轮）
```

说明：`clear_template` 属于项目脚手架 / 首次初始化逻辑，不计入上述 SSE 步骤枚举；checkpoint 恢复时会跳过已完成阶段。默认管线为 **chrome-first**（见 `docs/product/chrome-first-generate-pipeline-architecture.md`、ADR-0005）；Chrome Scaffold 始终落壳，仅 screenshot replicate 可为 pass-through。

4.2 analyze_project_requirement（含并行 infer_design_intent）

这是整个 pipeline 的「结构化大脑」，将用户的一句话转化为 **ProjectBlueprint**。与之**并行**的 `infer_design_intent` 产出自然语言设计意图；规划完成后，其中的 `technicalKeywords` 会并入 `experience.designIntent.keywords`，供 Hero 运行时 skill 路由使用。

特殊能力：配备了 web_search 工具。如果用户 prompt 包含不熟悉的品牌名、专有名词，LLM 会先搜索再分析（最多 4 次工具调用迭代）。

```typescript
// Blueprint 的核心结构
ProjectBlueprint {
  brief: {
    projectTitle: string
    projectDescription: string
    language: "zh" | "en" | ...    // 决定所有生成内容的语言
    productScope: {
      productType: string           // "SaaS landing page", "e-commerce", ...
      mvpDefinition: string
      coreOutcome: string           // 核心交付成果
      businessGoal: string          // 业务目标
      audienceSummary: string       // 目标受众描述
      inScope: string[]
      outOfScope: string[]
    }
    roles: UserRole[]               // 用户角色（访客、管理员等）
    taskLoops: TaskLoop[]           // 用户任务流程
    capabilities: CapabilitySpec[]  // 产品能力（must-have / should-have / nice-to-have）
  }
  experience: {
    designIntent: {
      mood: string[]                // ["energetic", "professional"]
      colorDirection: string        // "dark with orange accent"
      style: string                 // "modern minimalist"
      keywords: string[]
    }
  }
  site: {
    informationArchitecture: {
      navigationModel: string
      pageMap: PageMapEntry[]
      sharedShells: string[]
      notes: string[]
    }
    pages: PageBlueprint[]          // 每个页面及其 sections（layout chrome 由实现 Agent 决定）
  }
}
```

Blueprint 的容错设计：`asProjectBlueprint()` 函数支持三种 LLM 输出格式（嵌套结构、扁平结构、单页结构），并对每个字段做 normalize，确保即使 LLM 输出不完整也能得到合法的 Blueprint。

4.3 plan_project + resolve_design_system

- **plan_project** 扩展 `PlannedProjectBlueprint`（`pageDesignPlan`、sections 等）。
- 与它并行的 **DesignSystemResolver** 先加载内置 catalog，用确定性信号召回 Top 3，再由低成本 LLM 做保守裁决。显式选择或高置信自动命中时直接使用契约合格的 skill；无候选、低置信、歧义、冲突、自动匹配下的截图复刻或 matcher 异常时，才调用 **generate_project_design_system**。截图复刻仅跳过自动匹配；显式选择的版本化 skill 仍优先。
- Resolver 的唯一结果是 `DesignSystemResolution`。编排层根据结果唯一写入一次 `design-system.md`，并保存 `generate_project_design_system/resolution.json`（source、skill 版本、置信度、候选和回退原因）。动态生成结果会执行契约校验，失败时带错误重试一次。
- Skill fast path 可用 `DESIGN_SYSTEM_SKILL_FAST_PATH=0` 关闭；checkpoint 仍以最终 `design-system.md` 为恢复事实。

plan_project 的输出为每个 section 准备 traits 化的设计约束（layout/motion/visual/interaction），全局 chrome 仍由下游 Architect + Page Agent 落实。

4.4 Skill 体系（设计系统 / 用户 styleGuide / Hero 运行时）

1. **Design-system skill catalog**：`ai/flows/generate_project/prompts/skills/design-system/skill.yaml` 是唯一选择清单，登记 30 个版本化 skill 的文件、别名、正/负信号、产品类型与 surface mode。Catalog adapter 会验证每份 Markdown 都被清单覆盖；`reference-v1` 文件只提取 `<design-system>` 正文，再确定性补齐标准 Visual Contract / role tokens 并移除工程禁用构造，绝不把 `<role>` 指令注入生成管线。两种格式最终都必须通过同一 `open-ox-v1` 产物契约。
2. **显式选择**：请求可携带完整的 `selectedDesignSystemSkill: { id, version }`，版本与契约均通过后直接命中，不调用 matcher 或 generator；它可以覆盖截图复刻的自动回退。全局 kill switch 仍拥有最高优先级。旧 `styleGuide` 正文继续兼容，并参与自动匹配与生成回退。
3. **Hero 运行时组件 skill**：在特定页面 **`page_implement_agent` 启动前**调用 `discoverAndSelectSkill`，仅把正文注入该页 Agent；它与全局设计系统 catalog 是不同 seam。

`public/skills/` 下仍有大量面向用户的视觉模板文件；内置 section/hero 技能则服务于组件级代码生成。

4.5 Architect + Page Implement Agent（版面与页面落地）

**Chrome-first**：Plan 选定 `chromeForm` 后，由 **Architect Scaffold** 先落盘真实壳（`app/layout.tsx`、`components/chrome/**`），可选串行写入 `sharedContracts` stub；随后各 **Page Implement Agent** 在只读 chrome 契约下编写 `page.tsx` 及页面组件。`chrome_optimize_agent` 仅做链接 polish。详见 `docs/product/chrome-first-generate-pipeline-architecture.md` 与 ADR-0005。

页面 Agent 的 system 由 `frontend`、`steps/pageImplementAgent.md` 以及 `shared/agentRuleBundles.ts` 定义的 **有序 `loadGuardrail(id)` 列表** 叠加（`tailwindMappingGuide`、`section.default`、`skillIntegrationContract`、`project.*`、`outputTsx`、`framerMotionVariants` 等）。Architect Agent 使用另一组规则 id（含 `section.navigation`）。可选通过环境变量 `PAGE_IMPLEMENT_AGENT_EXTRA_RULES` / `ARCHITECT_AGENT_EXTRA_RULES` 追加规则 id。

User 消息侧注入设计系统、预读的 `layout.tsx` / `globals.css` / 目录树、页级 `pageDesignPlan`，以及（若存在）**Hero skill** 全文。Agent 必须以 **`page_implementation_complete`** 工具调用结束；全局 `next build` / 修复由流水线统一调度。

文件命名：Agent 产出的组件可按 `{scope}_{ComponentName}Section.tsx` 约定，scope 来自页面 slug，避免多页同名冲突。

4.6 install_dependencies 与生图等待

页面 Agent 完成后，流水线 **并行** 等待 `generate_image` 异步任务落盘（`await_images`），并对当前 `generatedFiles` 扫描 import，自动安装缺失 npm 包。repair 轮次后亦会再次安装新增依赖。

4.7 typecheck_generated + run_build + repair_build

默认在构建前对生成范围内的 TS/TSX 做 **语言服务级**检查（非全仓 `tsc`）；失败时可先走一轮 `repair_build` 式补丁。随后进入 `run_build`（内含 TS code-fix 重试内循环），若仍失败则最多 **5** 轮 `repair_build`。

```typescript
// 最多 5 轮修复（maxRepairAttempts = 5）
for (let repairRound = 0; repairRound <= maxRepairAttempts; repairRound++) {
  const buildResult = await stepRunBuild();
  if (buildResult.success) return { verificationStatus: "passed" };

  if (repairRound < maxRepairAttempts) {
    await stepRepairBuild({
      blueprint,
      buildOutput: buildResult.output,
      generatedFiles: result.generatedFiles,
    });
    await autoInstallDependenciesForFiles(/* touched */);
  }
}
```

repairBuild 的智能文件定位：从构建错误输出中提取文件名，只修复相关文件（有上限），避免 LLM 乱改无关代码。

构建结果的持久化：无论成功还是失败，构建输出都会写入 artifact 日志（`logs/generate_project/{runId}/run_build/build-output.log`），方便事后排查。

第五章：AI 修改 Pipeline 详解

5.1 架构来源：Claude Code 的 Agent Loop

修改流基于 Claude Code 的 query() 循环设计，核心思想：先行动，后思考。

```
runModifyProject(projectId, userInstruction, imageBase64?)
│
├── Step 1: resolve_project    读取项目元数据
├── Step 2: read_context       文件树 + design-system.md + globals.css
└── Step 3: agent_loop         while(true) 循环，最多 100 次迭代
      │
      ├── 第1次迭代：tool_choice="required"（强制使用工具，不允许空想）
      │
      ├── 工具执行（6种工具）：
      │   ├── read_file      读取文件内容
      │   ├── search_code    ripgrep 全局搜索
      │   ├── list_dir       列出目录结构
      │   ├── edit_file      精确字符串替换（old_string → new_string）
      │   ├── write_file     创建新文件
      │   └── run_build      执行 next build 验证
      │
      ├── Stop Hook（质量门控）：
      │   ├── 未搜索就停 → 注入错误，强制继续（最多 5 次）
      │   ├── 未编辑就停 → 注入错误，强制继续
      │   ├── 未构建就停 → 注入错误，强制继续
      │   └── 构建失败   → 注入错误日志，强制修复
      │
      ├── Step 4: compute_diffs   对比修改前后，生成 unified diff
      └── Step 5: update_registry 持久化到 modificationHistory
```

5.2 Agent 的自然语言理解

用户描述的是他们「看到」的东西，而不是代码结构。由 **Agent 在工具循环中**自行搜索、读文件并定位——不在 orchestration 层做关键词切分或固定路径猜测。

入口前先走 **LLM intent router**（`conversation` / `read_only` / `plan_only` / `code_change`），输出 `preloadPaths` 与 `scope`；下游只执行 router 的结构化决策，不再解析用户原文。

5.3 Stop Hook 的设计哲学

Stop Hook 解决 LLM 提前停止的问题。它**只检查循环状态**（是否用过工具、是否完成编辑、是否还有类型错误），并注入通用 Agent 指令——**不**从用户句子里提取搜索关键词，**不**硬编码 `components/sections` 等路径。

生产 `pnpm build` 在 loop 外由 `runFinalVerification` 执行；是否跳过 full build 由 intent router 映射的 `verificationMode` 决定，而非 touched-file 路径模式猜测。

```typescript
// 示意 — 见 ai/flows/modify_project/engine/stopHooks.ts
function runStopHook(loopState, userInstruction, modifyMode, { profile }) {
  if (!loopState.hasSearched && !loopState.hasEdited) {
    return modifyMode === "read_only"
      ? "Use read/search/list tools; answer in natural language; do not edit."
      : "Explore with tools from the file tree, then edit_file.";
  }
  if (modifyMode === "read_only" && loopState.hasSearched) return null;
  if (modifyMode === "code_change" && !loopState.hasEdited) return "Make edits now…";
  if (profile.verificationMode === "tsc_only") return null; // router chose style scope
  // … scoped tsc reminder when profile requires full verification
  return null;
}
```

关键参数：

- MAX_ITERATIONS = 100：防止无限循环
- MAX_STOP_HOOK_RETRIES = 5：防止 stop hook 本身造成死循环
- 每次 stop hook retry 后，tool_choice 重置为 "required"
- stop hook retry 计数在成功执行工具后重置为 0

tool_choice 的状态转换逻辑：

```
iterations === 1                → "required"（首次强制行动）
lastTransition === "stop_hook_retry" → "required"（被 stop hook 推回后强制行动）
lastTransition === "tool_execution"  → "auto"（已有上下文，让 LLM 自主决策）
```

5.4 对话记忆系统

```typescript
// 三层记忆合并
const dbHistory = project.modificationHistory   // DB 持久化历史
  .map(r => ({
    instruction: r.instruction,
    summary: r.plan?.analysis
      ? `${r.plan.analysis} Files: ${r.touchedFiles.join(", ")}`
      : `Modified ${r.touchedFiles.length} file(s)`,
  }));

const sessionHistory = conversationHistory;     // 本次 session 传入

// 去重合并（session 中已有的不重复），最多保留 10 轮
const seenInstructions = new Set(dbHistory.map(h => h.instruction));
const merged = [
  ...dbHistory,
  ...sessionHistory.filter(h => !seenInstructions.has(h.instruction)),
].slice(-10);
```

用户可以通过 `/clear` 命令清空 session 层记忆，同时设置 `clearContext=true` 标志，下次请求时服务端会忽略 DB 历史，从零开始。

5.5 图片输入支持（Vision）

用户可以粘贴截图，LLM 同时看到图片和文字描述：

```typescript
// ChatMessage content 支持 vision 格式
const messages: ChatMessage[] = [
  { role: "system", content: SYSTEM_PROMPT },
  {
    role: "user",
    content: imageBase64 ? [
      {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`,
          detail: "high",
        },
      },
      { type: "text", text: userMessage },
    ] : userMessage,
  },
];
```

图片在 modifyHistory 中也会被保留，前端会在对话气泡中展示缩略图。

5.6 Diff 计算与展示

修改完成后，系统计算每个被修改文件的 unified diff：

```typescript
// FileSnapshotTracker：在写操作前自动快照
class FileSnapshotTracker {
  async capture(relPath: string) {
    if (!this.snapshots.has(relPath))
      this.snapshots.set(relPath, await readFile(path.join(projectDir, relPath)) ?? "");
  }
  async computeAllDiffs() {
    // 对比快照与当前内容，生成 structuredPatch
  }
}
```

前端的 DiffBlock 组件支持折叠展开，按行着色（绿色=新增，红色=删除，蓝色=hunk header），并显示 +N/-N 统计。
第六章：预览系统（Storage / E2B / local）

6.0 Storage + `/site-previews` 代理（默认本地开发）

当设置 `OPEN_OX_PREVIEW_BACKEND=storage`（或在开发环境自动默认）时，宿主对 `sites/{projectId}` 执行带 basePath 的 `next build` 静态导出，将 `out/` 同步到 Supabase 桶 **`site-previews`**。浏览器通过同源路径 **`/site-previews/{projectId}/...`** 加载，由 Next.js 路由代理对象内容并放宽 CSP，避免直连 Storage 时的 `sandbox` CSP 阻断脚本。

6.1 E2B Cloud Sandboxes（`OPEN_OX_PREVIEW_BACKEND=e2b`）

以下 **6.3–6.4** 描述云端沙箱路径；Storage 路径则无常驻 sandbox 进程，而是每次同步静态产物（见 6.0）。

6.2 为什么选择静态导出而非 Dev Server

方案	启动时间	资源占用	URL 稳定性
next dev	15-30s	高（持续运行）	不稳定
next build + serve	30-60s（首次）	低（静态文件）	稳定

静态导出后用 `npx serve out -l 3000` 提供服务，URL 永久有效，资源占用极低。

6.3 E2B 完整启动流程

```
startDevServer(projectId)
│
├── 1. 查 Supabase sandbox_id → 尝试 reconnect 已有 sandbox
│      ├── sandbox 存活 + server 运行 → 直接返回 URL（最快路径）
│      ├── sandbox 存活 + /out 存在 → 重启 serve
│      └── sandbox 不存在/已过期 → 创建新 sandbox
│
├── 2. 创建 E2B sandbox（模板：NEXTJS_TEMPLATE）
│      模板预装：Node.js, npm, Next.js 及所有基础依赖
│
├── 3. 批量上传项目文件（20个/批，并行）
│      跳过：node_modules, .next, .git
│      特殊处理：package.json 使用模板版本（避免版本冲突）
│
├── 4. 注入 output: 'export' 到 next.config.ts
│      （静态导出必需，images.unoptimized: true）
│
├── 5. 智能依赖安装
│      对比项目 package.json 与模板 package.json
│      只安装模板中没有的新增依赖（大幅减少安装时间）
│
├── 6. next build → 静态导出到 /out
│
└── 7. npx serve out -l 3000（后台运行）
       等待 "Accepting connections" 输出
       返回 https://{sandbox.getHost(3000)}
```

6.4 Rebuild 优化

修改完成后触发 rebuildDevServer，复用已有 sandbox：

```
rebuildDevServer(projectId)
├── 连接已有 sandbox（不重建，节省 30s+）
├── kill 旧的 serve 进程
├── 重新上传修改的文件
├── 安装新增依赖（如有）
├── next build
└── 重启 serve
```

6.5 预览触发时机

预览不是自动启动的，而是按需触发：

- 用户点击右侧面板的 "Preview" tab → 触发 POST /preview（首次）
- 修改完成后 → 自动触发 PUT /preview（rebuild），并切换到 preview 面板
- 用户重新进入已有项目 → 预览状态为 idle，等待用户主动点击

这个设计避免无谓占用：**E2B** 仅在选用沙箱后端时创建隔离环境；**Storage** 后端则依赖指纹跳过未变更的导出上传。
第七章：前端架构

7.1 路由设计

路由	说明	特点
/	首页	唯一的创建入口，HeroPrompt 组件
/studio/[projectId]	Build Studio	动态路由，支持所有状态（generating/ready/failed）
/projects	项目列表	支持点击进入任意状态的项目
/build-studio	旧路由	保留兼容性

7.2 useBuildStudio 状态机

核心 hook，管理 Build Studio 页面的全部状态。项目加载时的状态判断：

```typescript
// 进入 /studio/[projectId] 时的四种情况
status === "generating" && buildSteps.length === 0
  → 首次访问（刚从首页跳转）
  → 自动调用 handleRun() 开始生成

status === "generating" && buildSteps.length > 0
  → 用户中途退出后重新进入
  → 启动 3s 轮询，显示已有进度，等待完成

status === "ready"
  → 直接加载历史数据，显示 modify 输入框

status === "failed"
  → 加载历史数据，显示错误信息和 retry 按钮
```

增量持久化机制：

```typescript
// 每个 step 完成时立即写入 DB
async (step: BuildStep) => {
  send({ type: "step", ...step });           // 推送到前端
  await appendBuildStep(projectId, step);    // 写入 Supabase
}
```

用户关闭页面后重新进入，能看到已完成的 steps，而不是空白。

Retry 清理机制：

```typescript
// retry 时先清空旧 buildSteps，防止幽灵节点
await updateProjectStatus(projectId, "generating", {
  error: undefined,
  buildSteps: [],  // 清空！
});
```

projectIdFromGenerationRef 的作用：当 handleRun() 完成并设置新的 projectId 时，通过这个 ref 告知 projectId effect "这个 ID 是刚刚生成的，不要重新 fetch"，避免覆盖刚刚完成的生成结果。

7.3 SSE 实时流处理

```typescript
// 前端消费 SSE 事件
const reader = res.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // 解析 "data: {...}\n\n" 格式
  const event = JSON.parse(line.slice(6));

  switch (event.type) {
    case "step":      // 更新 buildSteps 状态（upsert by step name）
    case "plan":      // 显示 AI 分析结果
    case "diff":      // 显示文件变更（流式追加）
    case "tool_call": // 显示工具调用（流式追加）
    case "thinking":  // 显示 AI 思考过程（流式追加）
    case "done":      // 完成，触发 preview rebuild
    case "error":     // 错误处理
  }
}
```

buildSteps 的 upsert 逻辑：前端按 step.step 字段做 upsert，同一个 step 的更新（running → done）会替换而不是追加，避免重复显示。

7.4 Slash Command 系统

通用 `useSlashMenu` hook，在两处复用：HeroPrompt（skill 选择）和 BuildConversation（/clear、/memory、/help）。

```typescript
// 通用接口
interface SlashCommand {
  id: string
  label: string
  description: string
  content?: string    // skill 文档内容（HeroPrompt 用）
  action?: () => void // 内置命令的执行函数（BuildConversation 用）
}

// 键盘导航：↑↓ 选择，Tab 补全，Enter 执行，Esc 关闭
// 匹配规则：id 前缀匹配 OR label 前缀匹配（不区分大小写）
```

HeroPrompt 中的 Skill 注入完整流程：

```
用户输入 /minimal
  → 弹出 skill 菜单（从 /api/skills 获取列表）
  → 选择 "Minimal Style"
  → fetch /skills/minimal.md 获取完整内容
  → 显示 badge：/minimal style applied
  → 提交时：
      POST /api/projects { userPrompt: "...", styleGuide: "# Minimal Style..." }
      服务端存储 styleGuide 到响应
      前端存入 sessionStorage["styleGuide:{projectId}"]
      handleRun() 读取 sessionStorage，传给 /api/ai
      /api/ai 传给 runGenerateProject({ styleGuide })
      仅注入 generateProjectDesignSystem 步骤（截断 1200 字符）
```

为什么不把 skill 内容塞进 userPrompt：完整 skill 文档 + 用户 prompt 会导致 analyzeProjectRequirement 的 prompt 过大，触发 LLM 超时（实际发生过）。

BuildConversation 中的内置命令：

- `/clear`：清空 session 层对话历史，设置 contextCleared=true，下次修改从零开始
- `/memory`：打开 MemoryDebugPanel，可视化查看当前 DB 历史 + session 历史的合并结果
- `/help`：显示所有可用命令列表（5 秒后自动消失）

7.5 BuildConversation 的实时状态展示

修改进行中时，BuildConversation 实时展示四类信息：

- Steps：resolve_project → read_context → agent_loop 的状态（running/done/error）
- Agent Thinking：LLM 的思考内容和每次迭代的调试信息（iter N, tool_choice, finish_reason）
- Tool Calls：每次工具调用的名称、参数摘要、结果摘要
- Changes：已完成的文件变更（MOD + 文件名 + +N/-N 统计）

修改完成后，历史记录中的 ModifyResultBubble 展示完整的 Analysis、Agent Log（折叠）、Changed Files（可展开 diff）。

第八章：数据持久化

8.1 Supabase 表结构

projects 表（核心）：

字段	类型	说明
id	text PK	{timestamp}_{slug} 格式
name	text	从 blueprint.projectTitle 更新
user_prompt	text	原始用户输入
status	enum	generating / ready / failed
blueprint	jsonb	完整 ProjectBlueprint（含 planProject 输出）
build_steps	jsonb[]	增量持久化的构建步骤
generated_files	text[]	生成的文件路径列表
modification_history	jsonb[]	每次修改的完整记录（含 diffs）
sandbox_id	text	E2B sandbox ID（用于 reconnect）
verification_status	enum	passed / failed
model_id	text	生成时使用的模型 ID

model_configs 表：用户自定义模型配置，支持添加任意 OpenAI-compatible 模型。

8.2 modificationHistory 的结构

每次修改完成后，一条 ModificationRecord 被追加到 modification_history 数组：

```typescript
interface ModificationRecord {
  instruction: string          // 用户的原始指令
  modifiedAt: string           // ISO 时间戳
  touchedFiles: string[]       // 被修改的文件列表
  plan: {
    analysis: string           // Agent 的分析摘要
    changes: Array<{
      path: string
      action: "modify" | "create" | "delete"
      reasoning: string        // "+N -N" 格式的统计
    }>
  }
  diffs: Array<{
    file: string
    reasoning: string
    patch: string              // unified diff 格式
    stats: { additions: number; deletions: number }
  }>
}
```

这个结构同时服务于两个目的：前端展示历史对话，以及下次修改时注入 prompt 作为记忆上下文。

8.3 文件存储（Supabase Storage）

生成的项目文件同时存储在本地文件系统（`sites/{projectId}/`）和 Supabase Storage。当本地文件丢失时（服务器重启等），E2B 预览会从 Storage 恢复文件。

8.4 Artifact 日志系统

每次生成/修改运行都会在 `logs/` 目录下创建一个带时间戳的运行目录，记录每个步骤的输入输出：

```
logs/generate_project/{runId}/
├── run/input.json
├── analyze_project_requirement/output.json
├── plan_project/output.json
├── generate_project_design_system/design-system.md
├── generate_project_design_system/resolution.json
├── page_implement_agent:about/output.json
├── run_build/build-output.log
└── run/result.json
```

这个系统对调试 LLM 输出质量问题非常有价值，可以精确定位是哪个步骤产生了问题。

第九章：模型配置系统

9.1 三层模型配置

优先级（高→低）：

```
1. Step 级 override：setStepModel("page_implement_agent", "gpt-5.2")

2. 请求级 override：setRuntimeModelId("gemini-3.1-pro-preview")

3. 全局默认：DEFAULT_MODEL = "gemini-3-flash-preview"

Modify Agent 另有 MODIFY_DEFAULT_MODEL（如 claude-opus-4-6），可与生成默认不同。
```

9.2 可配置的生成步骤

步骤 ID	说明	推荐策略
analyze_project_requirement	结构化 Blueprint	强模型
infer_design_intent	风格 / 技术关键词	强或均衡模型
plan_project	站点 / 页面规划	强模型
match_design_system_skill	Top 3 设计系统候选保守裁决	快模型
generate_project_design_system	Style Reference Markdown 设计系统	强模型
apply_project_design_tokens	globals.css 重写	中等模型
architect_scaffold_agent	Chrome 搭壳	可配轻模型
chrome_optimize_agent	Chrome 精修	强模型
page_implement_agent	单页工具闭环（多页并行）	快模型倾向（调用次数多）
repair_build	编译失败修复	强模型

（内部仍保留 `preselect_skills` 步骤 id 供 Hero 选型等复用，但不是全局流水线步骤。）

9.3 模型切换的实际影响

多页站点会并行启动多个 `page_implement_agent` 会话；每个会话都可能包含数十轮工具调用。将**快模型**配给该步骤，通常比旧版「逐文件 generate_section」更有利于缩短墙钟时间。
第十章：关键工程决策总结

10.1 为什么 buildSteps 增量持久化

生成过程耗时 90s+，用户可能中途关闭页面。如果只在完成时写入，重新进入会看到空白。增量写入确保每步完成后立即可见，提升用户体验，也为断点续跑奠定基础。

10.2 为什么区分设计系统匹配与运行时组件 Skill 发现

历史上的「所有 section 预先批量选 skill」会增加编排耦合与 prompt 体积。当前主路径把全局设计系统交给一个深 Resolver 模块，Hero 组件仍按需发现；两者的 catalog、契约与生命周期互不混用。

10.3 为什么 design-system 采用保守 Skill 快路径

误匹配会把整个项目锁进错误视觉方向，因此自动命中同时要求置信度 ≥0.86、无冲突，并与第二名保持足够差距。无法明确命中时动态生成，不为提高命中率牺牲准确性；模板本身必须符合当前 Visual Contract、token 和 Tailwind v4 契约。

10.4 为什么 projectId 在 AI 开始前就创建

这个决策解决了三个问题：

1. 用户可以随时关闭页面，重新进入时通过 projectId 恢复进度
2. 生成失败时有 projectId 可以 retry，不需要重新输入 prompt
3. URL 在生成开始前就确定，可以分享给他人（他们会看到生成进度）

10.5 为什么修改 Agent 强制先搜索再编辑

LLM 的一个常见失败模式是"凭记忆编辑"——它认为自己知道文件内容，直接调用 edit_file，但 old_string 与实际内容不匹配导致失败。强制先 search_code + read_file 确保 LLM 看到真实的当前代码，而不是训练数据中的印象。

10.6 为什么用 structuredPatch 而非 git diff

修改 Agent 运行在服务端，项目目录不一定是 git 仓库（或者有未提交的生成文件）。`structuredPatch`（来自 `diff` 包）直接对字符串内容做 diff，不依赖 git，更可靠。

10.7 Blueprint 的容错 normalize 设计

LLM 输出 JSON 时经常出现字段缺失、类型错误、结构不一致等问题。`asProjectBlueprint()` 函数对每个字段都有 normalize 逻辑和合理的 fallback 值，确保即使 LLM 输出不完整，pipeline 也能继续运行而不是崩溃。这比在 prompt 中反复强调"必须输出完整 JSON"更可靠。

第十一章：已知限制与未来方向

11.1 当前限制

- 静态导出限制：静态预览路径使用 `output: 'export'`，不支持动态 Server Components 数据获取、API Routes、Server Actions；产物为纯静态站点。
- 本地构建依赖：`run_build` 在主应用（或 worker）上执行 `next build`，高并发时会有资源竞争。
- 租户隔离：项目文件落在共享宿主文件系统 `sites/` 上，依赖上层认证与配额策略防止越权。
- 修改 Agent 的上下文窗口：100 次迭代 × 每次工具调用的输入输出，在复杂修改任务中可能接近模型的上下文限制。

11.2 潜在优化方向

- 断点续跑：生成中断后，从最后完成的 step 继续，而不是从头重跑
- 多页面并行：`page_implement_agent` 已按页并行；Architect 仍须先于页面批次串行完成。
- 增量修改：对于小改动（如改颜色、改文字），跳过 run_build 直接热更新预览
- 向量化记忆：将 modificationHistory 向量化，支持语义检索而不是简单的最近 N 轮截断
