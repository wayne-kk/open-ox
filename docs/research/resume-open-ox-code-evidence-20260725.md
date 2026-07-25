# Open-OX 简历代码证据研究

> 日期：2026-07-25  
> 目的：为“AI Coding / 前端 Leader”项目经历建立可追溯的代码证据。  
> 口径：只采用当前仓库的一手源码、配置、测试与 ADR；不把规划项当成已上线能力，不推断业务指标。

## 结论摘要

当前仓库可将项目定位为一个 **AI-native 网站生产引擎**：从自然语言 Brief 出发，生成真实 Next.js 工程，并覆盖设计系统、多 Agent 实现、依赖安装、构建修复、代码编辑、实时过程呈现、预览、自然语言修改、可视化源码回写和部署交付。官方 README 明确将产物定义为“可运行、可构建、可预览、可修改、可部署”的 Next.js 工程，而非截图或一次性代码片段（`README.zh-CN.md:15-17`, `README.zh-CN.md:50-60`）。

相比用户原稿，当前代码最值得强化的不是早期的 Dify Workflow 或 React Flow，而是：

1. 自研的分阶段、多 Agent 生成与修改编排；
2. Monaco 驱动的工程级代码工作台；
3. Storage / local dev / E2B 三类预览后端与静态预览可靠性工程；
4. Design Mode 从预览元素定位到 JSX AST 安全写回；
5. SSE + Studio Trace + Langfuse 的全链路可观测；
6. 构建门禁、定向修复、类型验证和细粒度测试形成的质量闭环。

## 可用于简历的事实主张

### 1. 产品与端到端交付

**可写主张**

> 主导 AI 建站平台前端与生成工作台建设，将自然语言需求转化为可运行、可构建、可预览、可修改、可导出的 Next.js 工程，覆盖生成、精修、预览与交付全链路。

**证据**

- README 对产品交付物及五种可交付状态有直接定义（`README.zh-CN.md:15-17`）。
- 生成流程被拆为 Intent、设计意图、规划、设计系统、Architect、Page Agents、依赖安装、构建与自动修复八类节点（`README.zh-CN.md:68-80`）。
- Studio 代码面板提供真实工作区文件读取、PATCH 写入与 ZIP 导出（`app/[locale]/studio/components/ProjectCodePanel.tsx:153-169`, `app/[locale]/studio/components/ProjectCodePanel.tsx:326-370`）。
- 工程可导出并支持 BYO Vercel Deploy；预览发布与生产部署被设计为独立能力（`README.zh-CN.md:148-157`）。

**边界**

- “全链路前后端项目”不够准确。当前生成核心明确面向 Next.js 网站/前端工程；主平台自身有 API、数据库和计费，但未看到通用业务后端生成器的同等证据。建议写“完整 Next.js 工程”或“可交付 Web 工程”。

### 2. 多阶段 AI 编排与生成 Agent

**可写主张**

> 设计并落地自研多阶段 AI 生成编排，将需求澄清、视觉意图、项目规划、设计系统、架构脚手架、页面实现、依赖解析和构建修复拆为可观测节点，并以并发 Page Agent 提升多页面生成吞吐。

**证据**

- 生成入口定义项目级运行上下文，并以页面 slug 标识实现 Agent、构建重试和修复步骤，说明流水线具备结构化节点模型（`ai/flows/generate_project/runGenerateProject.ts:183-223`）。
- Page Implement 并发上限在实现中显式设为 3（`ai/flows/generate_project/runGenerateProject.ts:113`）；不要使用旧架构文档中未经本次源码复核的“7+ Agent”指标。
- 自动依赖处理会扫描生成/修复文件，执行依赖安装，并将 installed / failed / skipped 结果写入步骤日志和 artifact（`ai/flows/generate_project/runGenerateProject.ts:226-293`）。
- 构建失败后进入定向 repair；若 verifier 对修复结果持怀疑态度，会将诊断重新喂给 repair，并合并触碰文件后重新安装相关依赖（`ai/flows/generate_project/runGenerateProject.ts:650-714`）。
- README 的流水线说明与源码职责一致（`README.zh-CN.md:68-80`, `README.zh-CN.md:198-205`）。

**前端 Leader 价值表达**

强调“把不可控大模型输出产品化”：将黑盒生成拆成稳定状态机/节点，前端可以实时呈现阶段、失败位置、产物与重试，而不是只展示 loading。

### 3. Monaco 工程级代码工作台

**可写主张**

> 深度集成 Monaco Editor，构建项目文件树、多标签编辑、脏状态保护、搜索/格式化、单文件及批量保存、外部 Agent 修改后增量刷新和 ZIP 导出的工程级代码工作台。

**证据**

- 项目依赖直接包含 `@monaco-editor/react`（`package.json:18-22`），编辑器采用动态导入避免 SSR（`app/[locale]/studio/components/ProjectCodePanel.tsx:35`）。
- 文件树支持目录构建、排序、展开和过滤（`app/[locale]/studio/components/ProjectCodePanel.tsx:42-69`, `app/[locale]/studio/components/ProjectCodePanel.tsx:206-210`）。
- Tab 状态包含 content / savedContent，能判断 dirty；Agent 修改通过 `workspaceEpoch` 触发刷新，并只回拉 clean tabs，避免覆盖用户未保存编辑（`app/[locale]/studio/components/ProjectCodePanel.tsx:184-204`, `app/[locale]/studio/components/ProjectCodePanel.tsx:232-275`）。
- 支持 ZIP 导出、单文件保存、Save All 并发写入和 Cmd/Ctrl+S 快捷键（`app/[locale]/studio/components/ProjectCodePanel.tsx:326-419`）。
- 工具栏调用 Monaco 内置 Find 与 Format Document action（`app/[locale]/studio/components/ProjectCodePanel.tsx:446-519`）。
- 多标签关闭时对未保存内容二次确认（`app/[locale]/studio/components/ProjectCodePanel.tsx:430-443`）。

### 4. Studio 生成过程可视化与流式交互

**可写主张**

> 构建 Studio 全链路可视化工作台，通过 SSE 流式呈现生成/修改步骤、日志、Agent 工具调用与结果，并提供拓扑、详情抽屉、事件流和 Trace 视图，提升长任务透明度与故障定位效率。

**证据**

- 修改 API 明确定义 SSE step / done / error 事件协议，并通过 `ReadableStream` 输出 Agent 事件（`app/api/projects/[id]/modify/route.ts:1-12`, `app/api/projects/[id]/modify/route.ts:155-163`）。
- Studio 组件层包含 `GenerationAtlas`、`StepNode`、`StageColumn`、`EventStream`、`TracePanel`、`DetailDrawer` 等独立视图（相应文件位于 `app/[locale]/studio/components/`）；README 对“拓扑、日志、Agent 步骤流式呈现”的产品行为给出确认（`README.zh-CN.md:102-106`）。
- 主应用架构为 Browser/Studio UI → Next.js API SSE 编排 → generate/modify AI Flows → Preview/Deploy（`README.zh-CN.md:177-188`）。

**边界**

- 当前 `package.json` 没有 React Flow 依赖，仓库源码检索也未发现 React Flow 使用。可以写“拓扑/流程可视化工作台”，不应写“当前项目深度集成 React Flow”。若 React Flow 属于历史版本，需由本人用旧提交、设计稿或发布记录补证。

### 5. 多后端预览与沙箱工程

**可写主张**

> 设计多后端预览基座，统一支持本地 `next dev`、E2B 云沙箱与 Supabase Storage 静态预览；围绕构建指纹、缓存复用、资源路径重写、并发上传、指数退避和预览代理完善可靠性。

**证据**

- 预览后端类型明确为 `local | e2b | storage`，并根据环境和依赖配置选择后端；生成/修改后静态发布与 Studio 当前预览后端相互独立（`lib/previewMode.ts:1-50`）。
- E2B 依赖和代码解释器依赖已接入（`package.json:20-21`, `package.json:30-32`）；沙箱管理 API 使用 E2B SDK 列举、关闭云沙箱并清理项目引用（`app/api/sandboxes/route.ts:1-16`, `app/api/sandboxes/route.ts:39-58`）。
- 静态预览执行 Next build，处理 basePath 和 public 根路径，并通过 `/site-previews` 代理规避 Supabase Storage CSP 对 iframe 脚本的阻断（`lib/staticSitePreview.ts:1-15`, `lib/staticSitePreview.ts:222-239`）。
- 静态产物上传默认并发为 8、上限 32，单文件最多重试 4 次，并对网络、网关、限流等瞬时错误执行指数退避（`lib/staticSitePreview.ts:74-112`, `lib/staticSitePreview.ts:242-321`）。这些是代码参数，不应转换为“性能提升 X%”。
- 预览构建包含项目指纹、in-flight 合并、构建产物复用和 build stamp 等机制（`lib/staticSitePreview.ts:35-57`）。

### 6. Design Mode 可视化编辑与源码安全回写

**可写主张**

> 设计 Design Mode 可视化精修链路，将预览元素映射到 `file:line:col` 源码坐标，通过服务端 JSX AST 定向修改样式，写回后自动格式化、类型验证并生成结构化 diff；无可靠映射时降级为用户确认的 Modify 草稿。

**证据**

- README 描述预览点选、颜色/字号/间距/圆角编辑、编译期 `data-ox-source` 坐标和服务端 JSX AST Direct Apply（`README.zh-CN.md:102-107`）。
- Direct Apply 明确是唯一自动写盘路径，要求每条 edit 都包含 source meta；缺少坐标会返回 `NO_SOURCE_MAPPING`，提示重建插桩预览或使用 Modify（`lib/studio/designMode/directPatch/applyDirectPatch.ts:49-70`）。
- 修改前以 `FileSnapshotTracker` 捕获文件，AST 写回后逐文件 Prettier 格式化和 TSX 验证，最终输出 changedFiles、patch 及 additions/deletions（`lib/studio/designMode/directPatch/applyDirectPatch.ts:31-47`, `lib/studio/designMode/directPatch/applyDirectPatch.ts:73-92`）。
- ADR 固化了 Direct Apply 唯一自动写盘、Modify 作为人工确认出口的产品/架构边界（`docs/adr/0001-design-mode-source-coordinate-direct-apply.md:1-17`）。

### 7. 自然语言 Modify Agent 与上下文治理

**可写主张**

> 建设自然语言修改 Agent，通过读/搜/编/构建工具循环完成跨文件改造，并引入意图路由、计划阶段、工具门禁、文件快照、上下文压缩、工作记忆与最终验证，控制长对话中的上下文噪声和写入风险。

**证据**

- Modify 能力在 README 中定义为读、搜、编、构建，配套结构化 diff、历史 turn 与可控记忆边界（`README.zh-CN.md:102-106`）。
- 代码结构将 loop engine、plan phase、verification、tool gate、stop hooks、context compression、completion summary、file snapshot tracker 拆为独立模块（`ai/flows/modify_project/engine/`, `ai/flows/modify_project/tracking/fileSnapshotTracker.ts`）。
- 工具循环会将工具名、参数、截断结果和 subagent 类型以事件发出，并持续维护 touchedFiles（`ai/flows/modify_project/engine/loopEngine.ts:246-276`）。
- 修改 API 在结束后调度预览重建，并将 changedFiles、diffs、buildPassed 等结果送回前端（`app/api/projects/[id]/modify/route.ts:24-29`, `app/api/projects/[id]/modify/route.ts:266-282`）。

### 8. AI 可观测、成本与运营质量

**可写主张**

> 建立 AI 全链路可观测体系，以项目为 Session 聚合 Intent、Generate、Modify 调用，跨 API/异步 Worker 延续 Trace；通过 AsyncLocalStorage 隔离并发 Agent 分支，并沉淀模型调用、步骤耗时、错误与成本分析能力。

**证据**

- Langfuse 是正式依赖（`package.json:37`），技术栈文档将 Langfuse 与 Studio SSE traces 列为可观测方案（`README.zh-CN.md:210-221`）。
- 默认按 projectId 聚合 intent/generate/modify session，intent 到异步 worker 共用 trace id，trace/span 命名集中管理（`lib/observability/langfuseTracing.ts:8-21`, `lib/observability/langfuseTracing.ts:145-159`）。
- 基于 AsyncLocalStorage 维护 trace/span 上下文；并发页面 Agent 使用隔离分支，防止 span stack 相互污染（`lib/observability/langfuseTracing.ts:23-33`, `lib/observability/langfuseTracing.ts:67-73`, `lib/observability/langfuseTracing.ts:261-312`）。
- Span 自动记录输出摘要和错误状态，HTTP/Worker 边界主动 flush（`lib/observability/langfuseTracing.ts:210-258`, `lib/observability/langfuseTracing.ts:314-319`）。
- `lib/observability/langfuseMetrics.ts` 提供日维度 metrics 与模型成本聚合；管理端另有 generation、funnel、retention、engagement、cost 等分析模块（`lib/admin/analytics/`）。简历可写“搭建指标体系/成本看板”，但是否本人主导需本人确认。

### 9. 工程质量与测试策略

**可写主张**

> 建立“生成即验证”的质量闭环：生成和可视化写回均经过类型/构建门禁，构建失败触发定向修复与 verifier 复核；为预览、编辑器状态、Agent 记忆、设计系统和鉴权等关键模块补充细粒度 Vitest 测试。

**证据**

- 工程脚本包含 TypeScript noEmit 检查和 ESLint，测试栈采用 Vitest + V8 coverage，并引入 fast-check 做性质测试（`package.json:5-16`, `package.json:74-83`）。
- 构建 repair 与 skeptical verifier refeed 形成闭环（`ai/flows/generate_project/runGenerateProject.ts:650-718`）。
- Design Mode 写回后逐文件执行类型诊断（`lib/studio/designMode/directPatch/applyDirectPatch.ts:31-45`, `lib/studio/designMode/directPatch/applyDirectPatch.ts:82-85`）。
- 仓库包含针对 Monaco TS defaults、tab 状态、iframe painted、preview fingerprint/cache/URL、构建修复、上下文记忆、intent router、design system resolver 等关键边界的测试文件，分布于 `app/[locale]/studio/lib/*.test.ts`、`lib/*preview*.test.ts`、`ai/flows/**/*.test.ts`。

## 原简历逐条校准

| 原表述 | 当前仓库证据 | 建议 |
|---|---|---|
| 深度集成 Monaco Editor 与 React-Flow | Monaco 有依赖与完整工作台实现；React Flow 无依赖/使用证据 | 拆开写。保留 Monaco；将 React Flow 改为“自研生成拓扑/流程可视化”，或补旧版本证据 |
| 搭建 Dify Workflow 前端项目生成全流程 | 当前仓库是自研 `generate_project` / `modify_project` 编排，未发现 Dify | 若描述当前项目，改为“自研多阶段 AI Pipeline / Agent 编排”；Dify 仅作为早期阶段另述 |
| 沙箱式项目预览基座 | 有 local / E2B / Storage 三后端和大量可靠性实现 | 强化为多后端预览架构，并点出缓存、指纹、重试、代理、路径重写 |
| RAG + 向量数据库验证 LLM 理解 | 当前依赖与源码未发现向量数据库、embedding 或 RAG 主链路 | 不以当前仓库背书。若确为本人 PoC，写“完成 PoC 验证”，并补技术方案/实验结论，避免声称已提升准确率 |
| 负责技术选型、视觉优化及底层渲染封装 | 技术栈、设计系统技能、Three.js、Design Mode 与预览桥接均可支持，但“负责”属于履历归因 | 可保留，最好补团队规模、决策范围和本人 ownership；不要仅罗列技术名 |

## 推荐简历版本（无虚构指标）

### Open-OX / AIGCoding 平台

项目简介：AI-native 网站生产平台，支持从自然语言 Brief 生成可运行、可构建、可预览、可修改、可导出的 Next.js 工程，覆盖 Studio 精修、社区发布与生产部署链路。

- 主导平台前端架构与 Studio 工作台建设，将需求澄清、视觉意图、项目规划、设计系统、页面实现、依赖解析、构建验证与自动修复拆分为可观测的多阶段 AI Pipeline，支持并发 Page Agent 生成。
- 深度集成 Monaco Editor，落地文件树、多标签编辑、脏状态保护、搜索/格式化、批量保存、Agent 写入后的增量同步及工程 ZIP 导出，打通“生成代码 → 人工精修 → 再生成”的协作闭环。
- 设计 local `next dev`、E2B 云沙箱、Supabase Storage 静态发布三类预览后端，完善构建指纹、缓存复用、资源路径重写、并发上传、失败重试与预览代理，保障生成/修改后的可分享预览。
- 建设 Design Mode 可视化编辑能力，以编译期源码坐标映射预览元素，通过服务端 JSX AST 定向写回样式，并在落盘后自动格式化、类型验证和生成结构化 diff。
- 搭建 SSE + Studio Trace + Langfuse 可观测体系，实时呈现 Agent 步骤与工具调用，按项目串联 Intent / Generate / Modify 及异步 Worker Trace，并支持并发 Agent 链路隔离和模型成本分析。
- 建立生成质量门禁：对依赖、TypeScript 与 Next.js 构建进行自动验证，构建失败触发定向修复和 verifier 复核，并以细粒度测试覆盖编辑器状态、预览缓存、Agent 上下文和设计系统等关键模块。

## 建议本人补充后再写的量化信息

仓库只能证明能力存在，不能证明个人贡献比例和业务效果。正式简历应从真实记录补充以下至少两类指标：

- 团队与 ownership：前端人数、跨职能协作规模、本人负责的模块边界；
- 效率：首屏预览时间、生成成功率、构建一次通过率、自动修复成功率、平均生成时长；
- 质量：线上错误率、预览失败率、回归缺陷数、测试覆盖变化；
- 业务：项目生成量、活跃用户、付费转化、部署/导出次数；
- 体验：Modify 使用率、Design Mode 应用成功率、用户完成一次交付所需轮次。

只有在有监控、报表、发布记录或实验数据支持时，才写“提升 X% / 降低 X%”。当前研究不提供任何此类推算。
