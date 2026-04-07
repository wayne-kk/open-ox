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
构建自动修复轮次	最多 2 轮
LLM 请求超时上限	300 秒
修改 Agent 最大迭代次数	40 次
对话记忆保留轮次	最近 10 轮
第二章：技术栈选型

2.1 主应用

层次	技术	选型理由
框架	Next.js 15 App Router	SSR + API Routes 合一，无需独立后端
语言	TypeScript 严格模式	AI 生成代码的类型安全是质量保障
样式	Tailwind CSS v4 + shadcn/ui (radix-nova)	CSS 变量驱动的主题系统，AI 可直接操作
数据库	Supabase (PostgreSQL)	托管 Postgres + 实时订阅 + Storage
预览沙箱	E2B Cloud Sandboxes	隔离的云端 Node 环境，支持 next build
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
│  POST /api/projects/[id]/preview → 启动 E2B 预览（POST=首次）    │
│  PUT  /api/projects/[id]/preview → 重建预览（修改后触发）        │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│  Supabase DB │   │   AI Pipeline    │   │  E2B Cloud Sandbox   │
│              │   │                  │   │                      │
│  projects    │   │  generate_project│   │  next build          │
│  model_configs│  │  modify_project  │   │  static export       │
│  Storage     │   │  shared/llm      │   │  npx serve           │
└──────────────┘   └──────────────────┘   └──────────────────────┘
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

4.1 完整的生成步骤

```
Step 1:  clear_template                 清理模板目录（仅首次，无 projectId 时）
Step 2:  analyze_project_requirement  ← LLM + web_search 工具
Step 3:  plan_project                 ← LLM ─┐ 并行执行
Step 4:  generate_project_design_system ← LLM ─┘ 节省一个 round-trip
Step 5:  apply_project_design_tokens  ← LLM（读 globals.css，写 @theme tokens）
Step 6:  preselect_skills             ← 单次批量 LLM（为所有 section 选 skill）
Step 7:  generate_section × N         ← 并行 LLM（每个 section 独立）
         compose_layout               ← LLM（生成 layout.tsx，与 section 生成串行）
Step 8:  compose_page × M             ← 并行 LLM（每个页面生成 page.tsx）
Step 9:  install_dependencies         ← 扫描生成文件，自动安装缺失 npm 包
Step 10: run_build                    ← next build（本地执行）
Step 11: repair_build × 0-2           ← LLM（构建失败时自动修复，最多 2 轮）
```

注意：`install_dependencies` 步骤在文档原版中未提及，但实际代码中存在。它会扫描所有生成的 TSX 文件，提取 import 语句，与 package.json 对比，自动安装缺失的依赖。

4.2 Step 2：需求分析（analyze_project_requirement）

这是整个 pipeline 的"大脑"，将用户的一句话转化为结构化的 ProjectBlueprint。

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
    layoutSections: SectionSpec[]   // nav, footer 等共享组件
    pages: PageBlueprint[]          // 每个页面及其 sections
  }
}
```

Blueprint 的容错设计：`asProjectBlueprint()` 函数支持三种 LLM 输出格式（嵌套结构、扁平结构、单页结构），并对每个字段做 normalize，确保即使 LLM 输出不完整也能得到合法的 Blueprint。

4.3 Step 3+4：并行规划与设计系统

plan_project 和 generate_project_design_system 都只依赖 blueprint，互不依赖，因此并行执行：

```typescript
const [blueprint, designSystem] = await Promise.all([
  stepPlanProject(normalizedBlueprint).then((bp) => {
    logger.logStep("plan_project", "ok", "section generation plans prepared");
    return bp;
  }),
  stepGenerateProjectDesignSystem(normalizedBlueprint, options?.styleGuide).then((ds) => {
    logger.logStep("generate_project_design_system", "ok", "design-system.md written");
    return ds;
  }),
]);
```

plan_project 的输出：为每个 section 生成详细的 SectionDesignPlan，包含：
- role：这个 section 在页面中扮演的角色
- layoutIntent：布局意图（"split hero with image right"）
- visualIntent：视觉意图（"high contrast, bold typography"）
- guardrailIds：适用的约束规则
- traits：结构化的 layout/motion/visual/interaction 特征描述（替代旧的 capabilityAssistIds 白名单）

plan_project 还有一个安全检查：如果 LLM 错误地把非 layout 类型的 section（如 hero、features）放进了 layoutSections，代码会自动将其移回 home 页面的 sections 列表。

generate_project_design_system 的输出：完整的 design-system.md，包含颜色系统、字体规范、间距规则、组件风格指导，后续所有 section 生成都以此为基准。如果用户通过 `/skill` 注入了 styleGuide，它会被截断到 1200 字符后注入此步骤。

4.4 Step 6：批量 Skill 预选（preselect_skills）

问题：原来每个 section 独立调用 LLM 选择 skill，N 个 section = N 次串行 LLM 调用，严重拖慢速度。

解决方案：将所有 section 的 skill 选择合并为单次 LLM 调用：

```typescript
// 单次调用，处理所有 section
const userMessage = JSON.stringify({
  productType: runtimeContext.productScope.productType,
  designKeywords: runtimeContext.designKeywords,
  sections: allSections.map(s => ({
    fileName: s.fileName,
    type: s.type,
    intent: s.intent,
    candidates: candidateSkills,  // 只传 metadata，不传 prompt 正文
  }))
});
// 返回：{ selections: { "HeroSection.tsx": "component.hero.impactful", ... } }
```

Skill 系统架构（public/skills/ 目录）：

```
public/skills/
├── minimal.md        # 极简风格：大量留白，单色调，字体主导
├── bold.md           # 大胆风格：高对比度，粗体排版
├── glassmorphism.md  # 玻璃拟态：毛玻璃效果，半透明层次
└── brutalist.md      # 野兽派：原始网格，强烈视觉冲击
```

每个 skill 文件是纯 Markdown，包含视觉方向、组件风格、色调描述。这是"菜单与菜谱分离"的设计：LLM 选择时只看菜单（文件名 + 描述），执行时才读菜谱（完整 prompt 正文），大幅减少 token 消耗。

Skill 选择的 fallback 机制：如果 LLM 返回的 skill id 不在合法列表中，或 LLM 调用失败，会自动降级到每个 section 类型的默认 fallback skill。

4.5 Step 7：Section 并行生成

每个 section 的 system prompt 由多层叠加构成：

```
system prompt =
  frontend.md              (Next.js/React 基础规范)
  + section.default.md     (通用 section 规则)
  + section.{type}.md      (类型特定规则，如 hero.md, pricing.md)
  + skill prompt           (选定的组件风格指导)
  + guardrail blocks       (约束规则，如 accessibility, above-fold)
  + traits block           (结构化特征提示，如 layout.split, motion.ambient)
  + outputTsx.md           (输出格式要求)

user message =
  design-system.md         (设计系统)
  + globals.css            (已有的 CSS，避免重复定义)
  + project context        (roles, taskLoops, capabilities)
  + page context           (slug, journeyStage, designPlan)
  + section spec           (type, intent, contentHints, designPlan)
```

生成后验证：每个 TSX 文件经过静态检查：
- 文件非空
- 有 `export function ComponentName` 或 `export default`
- 有 JSX return 语句

验证失败时自动 retry 一次，retry 时在 prompt 中注入具体的失败原因。

文件命名规则：section 文件按 `{scope}_{ComponentName}Section.tsx` 命名，例如 `home_HeroSection.tsx`、`layout_NavSection.tsx`。scope 来自页面 slug 或 "layout"，确保多页面项目中不同页面的同名 section 不会冲突。

4.6 Step 9：依赖自动安装（install_dependencies）

生成的 TSX 文件可能引用了模板中没有的 npm 包（如 `framer-motion`、`recharts` 等）。`install_dependencies` 步骤会：
1. 扫描所有生成文件的 import 语句
2. 与当前 package.json 对比，找出缺失的包
3. 自动执行 `npm install`
4. 记录安装成功/失败的包，供前端展示

这个步骤在 section 生成后和 repair_build 后各执行一次，确保修复过程中引入的新依赖也能被安装。

4.7 Step 10+11：构建验证与自动修复

```typescript
// 最多 2 轮修复
for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
  const buildResult = await stepRunBuild();  // next build
  if (buildResult.success) return { verificationStatus: "passed" };

  if (attempt < maxRepairAttempts) {
    const repairResult = await stepRepairBuild({
      blueprint,
      buildOutput: buildResult.output,
      generatedFiles: result.generatedFiles,
    });
    // 修复后自动安装新依赖，再继续下一轮 build
    await autoInstallDependenciesForFiles({ files: repairResult.touchedFiles });
  }
}
```

repairBuild 的智能文件定位：从构建错误输出中提取文件名，只修复相关文件（最多 6 个），避免 LLM 乱改无关代码。

构建结果的持久化：无论成功还是失败，构建输出都会写入 artifact 日志（`logs/generate_project/{runId}/run_build/build-output.log`），方便事后排查。

第五章：AI 修改 Pipeline 详解

5.1 架构来源：Claude Code 的 Agent Loop

修改流基于 Claude Code 的 query() 循环设计，核心思想：先行动，后思考。

```
runModifyProject(projectId, userInstruction, imageBase64?)
│
├── Step 1: resolve_project    读取项目元数据
├── Step 2: read_context       文件树 + design-system.md + globals.css
└── Step 3: agent_loop         while(true) 循环，最多 40 次迭代
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

用户描述的是他们"看到"的东西，而不是代码结构。Agent 的 system prompt 专门处理这种映射：

```
用户说：                          Agent 理解为：
"那个极致性能的区块"          →  搜索包含"性能"/"performance"的 section 文件
"首页那个大标题太小了"        →  home_HeroSection.tsx 中的 heading 元素
"导航栏的颜色不对"            →  layout_NavSection.tsx 或 app/layout.tsx
"底部的版权信息"              →  layout_FooterSection.tsx
```

Agent 被要求先用中文关键词搜索，如果没有匹配再尝试英文等价词（性能→Performance，导航→Nav，标题→title/heading）。

5.3 Stop Hook 的设计哲学

Stop Hook 解决了 LLM 的一个常见问题：在没有完成任务的情况下提前停止。

```typescript
function runStopHook(loopState: LoopState, userInstruction: string): string | null {
  if (!loopState.hasSearched && !loopState.hasEdited) {
    // 提取关键词，给 LLM 具体的搜索建议
    const keywords = userInstruction
      .replace(/[，。！？、\s]+/g, " ")
      .split(" ")
      .filter(w => w.length >= 2)
      .slice(0, 5);
    return `You stopped without using any tools. MUST search first.
    Try: search_code with keywords: ${keywords.map(k => `"${k}"`).join(", ")}`;
  }
  if (!loopState.hasEdited) {
    return "You searched but didn't make any changes. Read the files and make edits.";
  }
  if (!loopState.hasBuild) {
    return "You've made changes but haven't verified. Call run_build.";
  }
  if (!loopState.buildPassed) {
    return `Build failed:\n${buildOutput}\nFix the errors.`;
  }
  return null; // 所有门控通过，允许停止
}
```

关键参数：
- MAX_ITERATIONS = 40：防止无限循环
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
第六章：预览系统（E2B Cloud Sandboxes）

6.1 为什么选择静态导出而非 Dev Server

方案	启动时间	资源占用	URL 稳定性
next dev	15-30s	高（持续运行）	不稳定
next build + serve	30-60s（首次）	低（静态文件）	稳定

静态导出后用 `npx serve out -l 3000` 提供服务，URL 永久有效，资源占用极低。

6.2 完整启动流程

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

6.3 Rebuild 优化

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

6.4 预览触发时机

预览不是自动启动的，而是按需触发：
- 用户点击右侧面板的 "Preview" tab → 触发 POST /preview（首次）
- 修改完成后 → 自动触发 PUT /preview（rebuild），并切换到 preview 面板
- 用户重新进入已有项目 → 预览状态为 idle，等待用户主动点击

这个设计避免了每次生成都启动 E2B sandbox 的资源浪费，只有用户真正需要预览时才消耗沙箱资源。
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
├── generate_section:home:HeroSection/output.json
├── generate_section:home:HeroSection/generated-file.tsx
├── run_build/build-output.log
└── run/result.json
```

这个系统对调试 LLM 输出质量问题非常有价值，可以精确定位是哪个步骤产生了问题。

第九章：模型配置系统

9.1 三层模型配置

优先级（高→低）：
```
1. Step 级 override：setStepModel("generate_section", "gpt-5.2")
   → 特定步骤使用特定模型

2. 请求级 override：setRuntimeModelId("gemini-3.1-pro-preview")
   → 本次请求全程使用此模型

3. 全局默认：DEFAULT_MODEL = "gemini-3-flash-preview"
```

9.2 可配置的生成步骤

步骤 ID	说明	推荐策略
analyze_project_requirement	需求分析（最重要）	强模型（理解力优先）
plan_project	项目规划	强模型
generate_project_design_system	设计系统生成	强模型
apply_project_design_tokens	设计 Token 应用	中等模型
preselect_skills	Skill 预选	快模型（简单分类任务）
generate_section	组件生成（数量最多）	快模型（速度优先）
compose_page	页面组合	中等模型
repair_build	构建修复	强模型（需要理解错误）

9.3 模型切换的实际影响

在一个有 8 个 section 的项目中，generate_section 步骤会并行发起 8 次 LLM 调用。如果使用慢模型（如 GPT-4o），这 8 次调用的最长耗时决定了这个步骤的总耗时。使用快模型（如 gemini-flash）可以将这个步骤从 ~40s 压缩到 ~15s。

因此推荐的配置策略是：analyze + plan + design_system 用强模型保证质量，generate_section 用快模型保证速度。
第十章：关键工程决策总结

10.1 为什么 buildSteps 增量持久化

生成过程耗时 90s+，用户可能中途关闭页面。如果只在完成时写入，重新进入会看到空白。增量写入确保每步完成后立即可见，提升用户体验，也为断点续跑奠定基础。

10.2 为什么 preselect_skills 合并为单次调用

原来：N 个 section × 1 次 LLM = N 次串行调用（每次 ~2s = 总计 N×2s）
现在：所有 section 合并为 1 次 LLM 调用（~3s，无论 N 多大）

对于一个有 8 个 section 的网站，节省约 13 秒。

10.3 为什么 plan_project 和 generate_design_system 并行

两者都只依赖 blueprint，互不依赖。并行执行节省一个完整的 LLM round-trip（~10-20s）。

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

- 静态导出限制：E2B 预览使用 `output: 'export'`，不支持 Server Components 的动态数据获取、API Routes、Server Actions。生成的网站是纯静态的。
- 本地构建依赖：`run_build` 步骤在主应用服务器上执行 `next build`，高并发时会有资源竞争。
- 单用户模型：当前没有用户认证，所有项目共享同一个服务器文件系统。
- 修改 Agent 的上下文窗口：40 次迭代 × 每次工具调用的输入输出，在复杂修改任务中可能接近模型的上下文限制。

11.2 潜在优化方向

- 断点续跑：生成中断后，从最后完成的 step 继续，而不是从头重跑
- 多页面并行：当前 layout sections 和 page sections 是串行的，可以进一步并行
- 增量修改：对于小改动（如改颜色、改文字），跳过 run_build 直接热更新预览
- 向量化记忆：将 modificationHistory 向量化，支持语义检索而不是简单的最近 N 轮截断