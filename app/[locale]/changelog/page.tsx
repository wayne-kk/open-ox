import { ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

interface ChangeEntry {
  version: string;
  date: string;
  tag: "major" | "minor" | "fix" | "perf";
  title: string;
  body: string;
  items: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: "v1.14",
    date: "2026-07-14",
    tag: "minor",
    title: "Credits · 注册欢迎礼 12（取代 Free 日发）",
    body: "Free 改为首次确保账户一次性送 12 积分；Generate 门禁 8；无产物不扣 Generate；跑后扣费封顶到余额。定价文案与积分不足跳转 /pricing 已对齐。",
    items: [
      "welcome / legacy migrate 幂等入账；停用每日 Free 发放",
      "MIN_GENERATE=8；spend clamp；Generate 仅 success 扣费",
      "docs/product/credits-v0.3-welcome.md",
    ],
  },
  {
    version: "v1.13",
    date: "2026-07-11",
    tag: "minor",
    title: "Credits · Stripe Pro / top-up / pricing",
    body: "积分进入可付费阶段：Pro 月订阅、一次性加量包、/pricing 页与 Stripe Webhook 入账。Free 日额度保留；取消订阅后余额不立刻清零。",
    items: [
      "迁移 027：stripe_customer / subscription 字段 + billing_stripe_events 幂等表",
      "Checkout + Customer Portal；ledger grant_monthly / grant_topup",
      "GET /api/billing/catalog · POST /api/billing/checkout|portal|webhook",
      "侧栏积分徽章链到 /pricing",
    ],
  },
  {
    version: "v1.12",
    date: "2026-07-11",
    tag: "minor",
    title: "Modify · 工作记忆投影",
    body: "短程续写不再依赖「最近 10 轮全文」。每次请求从 turn 列表确定性投影状态卡（焦点文件 / 未决问题），再配最近 2 轮原文（非对称截断），压低历史噪音、稳住「再大一点」类指代。",
    items: [
      "projectWorkingMemory：focusFiles / pendingQuestion / lastIntent 等由纯函数投影，不新增 DB 列",
      "主 Agent 与 Intent Router 共用投影；/clear 清空后自然无工作记忆",
      "GET /api/projects/[id]/memory 与 Studio MemoryDebugPanel 可观测注入内容",
    ],
  },
  {
    version: "v1.11",
    date: "2026-07-10",
    tag: "major",
    title: "工作台改版 · /dashboard + App Shell",
    body: "登录后主入口迁到 /dashboard：大号构建 composer、侧栏「我的项目 / 文件夹 / 社区」、统一产品壳在 dashboard ↔ community 间保持挂载。旧 /projects 列表 URL 重定向并保留 query。",
    items: [
      "路由：/dashboard 为 Workspace；/community 为发现；Studio 仍独立全屏",
      "AppShell：开始构建锚点、文件夹展开、返回路径 captureAppReturnTo",
      "项目卡片：发布 / Remix 开关、封面、生成中可进 Studio",
    ],
  },
  {
    version: "v1.10",
    date: "2026-07-09",
    tag: "major",
    title: "Workspace 默认私有 · Community · Publish / Remix",
    body: "下线「已登录全员可读」广场。Workspace 只看自己的项目；开启 Publish Preview 后进入 /community 静态发现；Allow Remix 为独立拷贝许可轴。见 ADR-0002。",
    items: [
      "默认私有：列表 API / RLS 仅所有者；社区列表走 Publish Preview + listed",
      "两轴：Publish Preview（上架+静态预览）与 Allow Remix（登录后拷贝）；关 Preview 自动关 Remix",
      "POST /api/projects/[id]/remix：拷源码快照+血缘，不含 Studio 对话与密钥",
      "非所有者不可进他人 Studio；未发布预览/封面对非所有者硬切断",
      "Admin 保留全量项目与强制下架，不进入社区产品面",
    ],
  },
  {
    version: "v1.9",
    date: "2026-07-07",
    tag: "major",
    title: "Studio Design Mode · 点选直改源码",
    body: "Live preview 点选元素，调色 / 字号 / 间距 / 圆角后 Direct Apply：编译期 data-ox-source 坐标定位 + 服务端 JSX AST 写盘。不可 Direct 时预填 Modify 草稿由用户确认。见 ADR-0001。",
    items: [
      "P0-A Design Mode Lite：overlay + bridge；local next-dev 预览下可 Direct Apply",
      "M2：源坐标锚点、POST /api/projects/[id]/design-mode/patch、失败走 Modify 人工出口",
      "backfill 接口补齐历史项目锚点；静态 site-previews 无锚点时预检后改走 Modify",
    ],
  },
  {
    version: "v1.8",
    date: "2026-06-18",
    tag: "minor",
    title: "Google 登录",
    body: "认证增加 Google OAuth，与飞书并列；/auth 按配置展示可用提供商，登录后按 redirect 回跳（含未登录构建草稿续写）。",
    items: [
      "GET /api/auth/google/start + callback；safeRedirect 防开放重定向",
      "GET /api/auth/config 暴露当前启用的登录方式",
    ],
  },
  {
    version: "v1.7",
    date: "2026-06-05",
    tag: "minor",
    title: "生成流水线 · Chrome 两阶段 Agent",
    body: "全局 chrome 拆为 architect_scaffold_agent（快速搭壳、链接可占位）与 chrome_optimize_agent（全部页面落盘后勘察真实路由与 section id，精修 Nav/Footer）。Page Agent 全程只读 chrome。",
    items: [
      "编排：scaffold → page_implement_agent ×N → chrome_optimize → await_images / install_deps",
      "checkpoint：skipScaffold / skipChromeOptimize；旧 architect_agent 完成记录视为 scaffold 已完成",
      "Page Agent：单页主区块须带 section id；禁止在 page 内重复全局 Nav/Footer",
    ],
  },
  {
    version: "v1.7",
    date: "2026-05-21",
    tag: "minor",
    title: "多模态生成 · 参考图进流水线",
    body: "创建项目可携带参考图（imageBase64）；生成链路按 screenshotIntentMode（复刻布局 / 提取灵感）把视觉上下文注入 design intent 与 page implement，配合既有 screenshot guardrail。",
    items: [
      "POST /api/projects 支持 imageBase64；HeroPrompt / Studio 粘贴截图 chip",
      "resolveScreenshotIntentMode + vision content 贯穿 blueprint / 设计系统 / 页面实现",
    ],
  },
  {
    version: "v1.6",
    date: "2026-05-19",
    tag: "minor",
    title: "文档与预览说明对齐当前实现",
    body: "技术文档、首页文档索引与 README 已与代码一致：主路径为 Architect → page_implement_agent；设计系统改为 infer + generate_project_design_system（已移除 match_design_system_skill 与内置 design-system skill 目录）；预览支持 local / storage（默认 dev）/ e2b 三种后端；修正构建修复轮次与模型步骤表等过时描述。",
    items: [
      "docs：流水线步骤含 validate_skill_prompts、await_images、typecheck_generated；移除已废弃的全局 preselect_skills / generate_section 主路径描述",
      "docs：预览沙箱页补充 Storage + `/site-previews` 代理与 OPEN_OX_PREVIEW_BACKEND 选型",
      "docs：Section 生成页改为 Page Implement Agent + Hero 运行时 skill 发现；设计系统页对齐并行编排与 token 写入方式",
      "README：Next.js 16 / React 19，预览与 Storage 双 bucket 架构简述",
    ],
  },
  {
    version: "v1.5",
    date: "2026-05-11",
    tag: "perf",
    title: "生成流水线 · Architect 先于 Page Agent",
    body: "`architect_agent` 在全部 `page_implement_agent` 之前串行结束，各页预读到的 `app/layout.tsx` 与最终 chrome 落盘一致，降低重复导航/页脚等壳层风险。多页实现仍彼此并行。",
    items: [
      "apply_project_design_tokens 之后：先 `runArchitectStep`，再 `generatePages`（移除与 Page Agent 的 Promise.allSettled 并行）",
      "内部文档 `docs/architecture.md` 与 `app/docs/pipeline` 步骤说明已同步",
    ],
  },
  {
    version: "v1.4",
    date: "2026-05-10",
    tag: "fix",
    title: "生成流水线 · globals 竞态修复与编排调整",
    body: "修复「日志里 apply_project_design_tokens 看似正确，磁盘上 globals.css 却不像 LLM 产出」的问题；统一由设计系统 Markdown + 当前 globals 走 LLM，并收紧 Agent 对全局样式文件的写入。",
    items: [
      "apply_project_design_tokens 与 Architect / Page Agent 不再并行：token 步骤先落盘 app/globals.css，避免带 write_file 的代理在之后覆盖",
      "apply_project_design_tokens 仅消费设计系统正文与站点当前 globals，不再读取或复制 skills 下的 *.globals.css",
      "Architect 与多页 page_implement_agent 曾在 token 完成后并行（v1.5 起改为 Architect 先完成，再启动各页）",
      "checkpoint skipArchitect 恢复时：generatedFiles 计入磁盘上已有的 app/layout.tsx 与 components/chrome/**",
      "apply_project_design_tokens：提高 LLM 输出 token 上限（8k），降低超长 globals.css 截断风险",
      "architect_agent 提示词去掉「须先跑 format_code」的误导，与 write_file 自动 Prettier 一致",
      "docs/pipeline：移除已废弃 section 流水线步骤，补充 typecheck_generated，步骤编号与主路径对齐",
      "移除 scripts/codegen-skill-globals.mjs、根目录 _test_parse.mjs，删除 package.json 中的 codegen:skill-globals 脚本",
    ],
  },
  {
    version: "v1.3",
    date: "2026-04-12",
    tag: "major",
    title: "账号主流程 · 全员项目广场",
    body: "飞书登录与回跳闭环、会话与退出体验优化；未登录发起构建可接续；项目列表默认按成员浏览团队全部作品。",
    items: [
      "独立 /auth 登录流程：飞书授权、错误提示、登录后按 redirect 回到来源页（含首页构建场景）",
      "未登录在首页填写需求并点「构建」→ 完成登录后自动恢复草稿并继续创建项目，无需再点一次",
      "项目页「全部成员 / 我的项目」：默认展示所有人项目并按创建者分组；「我的」下仍可用文件夹筛选",
      "全员列表仅本人项目显示删除；退出登录路径优化，减轻顶栏布局抖动与不必要的全页刷新",
    ],
  },
  {
    version: "v1.2",
    date: "2026-04-08",
    tag: "major",
    title: "生成链路升级 — 6 步到 8 核心节点",
    body: "为提升页面整体一致性与风格稳定性，新增独立风格推理与页面级 section 设计描述两个节点；并将 requirement 输出收敛为最小结构。",
    items: [
      "analyze_project_requirement 输出收敛为最小结构：brief + site（不再混入 designIntent）",
      "新增 infer_design_intent：独立风格推理节点，产物注入 generate_project_design_system",
      "新增 describe_page_sections：先整页结构描述，再拆分每个 section 的布局/背景/层次",
      "analyze_project_requirement 与 infer_design_intent 并行执行，减少串行等待",
      "site shell 输入改为扁平结构：site.navigation / site.footer，与 pages 同层",
      "normalizeBlueprint 兼容新旧输入形状，保证链路平滑迁移",
    ],
  },
  {
    version: "v1.1",
    date: "2026-04-08",
    tag: "major",
    title: "架构收敛 — Flow 模块化 + Prompt 统一与去重",
    body: "本次针对可维护性投诉做系统性重构：拆分 generate/modify 巨型流程文件，收敛 LLM 调用层，Studio 类型去 any，并把提示词加载改为统一 Prompt Core，同时清理重复提示词来源，减少冲突与漂移。",
    items: [
      "Modify Flow 模块化：runModifyProject 拆分为 facade + loopEngine + stopHooks + context + tracking + prompt",
      "Generate Flow 抽取：新增 normalization 与 orchestration 层（resultAccumulator / buildRepairLoop / sectionBatchRunner 等）",
      "LLM 层统一：shared/llm 拆为 gateway、toolLoop、errorClassifier、contentExtractors，并保留 facade 导出",
      "Blueprint 规范化收口：normalizeBlueprint 独立为 schema 模块，并增加输入形状检测与 fallback 告警",
      "Studio 类型收口：BlueprintOverview 引入 ViewModel mapper，移除组件内 as any 读取",
      "Prompt Core 上线：统一 prompt catalog/loader/composer，旧 loadStepPrompt/loadGuardrail 接口兼容接入",
      "Modify 系统提示词迁移到 Markdown：从代码硬编码改为 prompts/system/modifyAgent.md",
      "提示词去重落地：section.default 中与 outputTsx 重复约束已删除，outputTsx 作为单一权威来源",
      "测试护栏补齐：新增 stopHooks、contentExtractors、normalizeBlueprint、buildRepairLoop、prompt composer 测试",
    ],
  },
  {
    version: "v1.0",
    date: "2026-04-07",
    tag: "major",
    title: "Pipeline 重构 — Traits 系统 + 运行时 Skill 发现 + 并行提速",
    body: "生成流水线的架构级重构。用结构化 Traits 替代 capability assist 白名单，移除全局 preselect_skills 步骤改为每个 section 运行时自发现 skill，design tokens 与 section 生成并行执行，repair_build 升级为 Agent 工具循环。",
    items: [
      "Traits 系统：SectionDesignPlan 中的 capabilityAssistIds 替换为结构化的 layout/motion/visual/interaction traits",
      "运行时 Skill 发现：移除全局 preselect_skills 步骤，每个 section 在生成时自行发现并选择 skill（score-based fallback）",
      "design_tokens ∥ section_generation：两者不再串行，Promise.all 并行执行",
      "repair_build 升级为 Agent 工具循环：使用 read_file / edit_file / write_file / run_build 工具，替代旧的 JSON 批量写入",
      "LLM 重试：chatCompletion 加入指数退避重试（500/502/503 + Thinking signature error），最多 2 次",
      "模型配置：ModelConfig 新增 supportsThinking 字段，运行时可查询模型是否支持 thinking 模式",
      "composePage 安全增强：import 去重 + 重复渲染检测 + 自动 rebuild",
      "Section 去重：normalizeBlueprint、页面生成、composePage 三层去重，防止 LLM 输出重复 section",
      "Prompt 精简：删除 7 个 section prompt、3 个 motion prompt、2 个 capability prompt、5 个 layout prompt，统一收敛到 section.default + skill",
      "planProject 精简：SectionDesignPlan 验证从 15 字段缩减到 traits-based 结构",
    ],
  },
  {
    version: "v1.0",
    date: "2026-04-07",
    tag: "minor",
    title: "Studio UI 优化",
    body: "GenerationAtlas 拓扑图 memoize 优化，DetailDrawer 从 fixed 改为 absolute 定位，避免遮挡全局导航。",
    items: [
      "GenerationAtlas：useMemo + stepsFingerprint 避免每次渲染重新解析拓扑",
      "DetailDrawer：backdrop 和抽屉从 fixed 改为 absolute，作用域限定在父容器内",
    ],
  },
  {
    version: "v0.9",
    date: "2026-04-06",
    tag: "major",
    title: "统一触发器系统 — / @ # URL 图片",
    body: "HeroPrompt 输入框从单一的 /skill 升级为多触发器架构。支持在文本任意位置触发，选中后以彩色 chip 形式注入。",
    items: [
      "/ 风格模板：选择设计风格（如 /glassmorphism），注入 styleGuide",
      "@ 参考项目：引用已生成的项目作为设计参考，注入 referenceProjectId",
      "# 约束标签：添加约束条件（#暗色主题 #极简 #中文），追加到 prompt",
      "URL 自动检测：粘贴 URL 自动提取为 chip，传递 referenceUrl",
      "图片粘贴：粘贴截图自动转为带缩略图的 chip，传递 imageBase64",
      "快捷模板 pills：输入框为空时显示 SaaS/作品集/电商等一键模板",
      "统一架构：usePromptTriggers hook + TriggerMenu + PromptChips 组件解耦",
    ],
  },
  {
    version: "v0.8",
    date: "2026-04-05",
    tag: "major",
    title: "Modify Agent 架构升级 — 对标 Claude Code",
    body: "基于 Claude Code 架构文档的全面对标分析，从模型路由、工具能力、上下文管理到 Agent 行为模式的系统性升级。",
    items: [
      "模型路由解耦：modify 不再依赖全局 _runtimeModelId，通过函数参数传递",
      "think 工具：内部推理 scratchpad，无副作用，用于复杂编辑前的规划",
      "revert_file 工具：基于 FileSnapshotTracker 快照回滚，打转时可一键恢复",
      "read_file 支持 start_line/end_line 行范围读取",
      "exec_shell 加入 modify 工具列表",
      "parallel_tool_calls: true 启用并行工具调用",
      "Must read before edit 保护：edit_file 前必须先 read_file",
      "Tool Result Budget：单条结果上限 30K 字符，防止 context 爆炸",
      "基于相关性的 Context 压缩：热文件保留完整，冷文件压缩",
      "Loop Detection：连续 4 次操作同一文件时注入策略转换提示",
      "4-Phase Progressive Workflow：Orient → Deep Read → Edit → Verify",
      "edit_file 失败时的近似行匹配诊断",
      "System Prompt 加入 Claude Code 核心准则（先诊断再换策略、简洁输出）",
    ],
  },
  {
    version: "v0.8",
    date: "2026-04-05",
    tag: "minor",
    title: "首页全面升级",
    body: "首页从三段式（Hero + How it Works + Features）升级为五段式，增加数字指标栏和 CTA 区域，Features 从 3 张扩展到 6 张带指标的卡片。",
    items: [
      "Stats Bar：~30s / 6 步 / 2x 修复 / ∞ 迭代 — 全宽数字指标栏",
      "Features 重做：6 张卡片，每张带右上角大数字指标 + hover 光晕",
      "CTA Section：Footer 前的全宽 call-to-action 区域",
      "AgentFlowDemo 重写：粒子流、节点呼吸灯、完成径向波纹、并行分裂动画、修复回路",
      "Footer 重做：四栏布局（品牌 + 产品 + 资源 + 社交）",
      "全站中文化（主标题保留英文）",
    ],
  },
  {
    version: "v0.7",
    date: "2026-04-04",
    tag: "major",
    title: "修改 Agent v7 — 受 Claude Code 启发的循环架构",
    body: `修改流的完整重写。用开放式 Agent 循环替代了原来的"先规划后执行"模型，在单次循环中完成搜索、阅读、编辑和验证。`,
    items: [
      "Stop Hook：质量门控，防止 Agent 在搜索、编辑和构建之前停止",
      "首次迭代 tool_choice='required' — Agent 必须先行动再思考",
      "对话记忆：DB 历史 + session 历史合并去重，最多保留 10 轮",
      "图片输入：可以粘贴截图配合文字指令",
      "FileSnapshotTracker：自动为每个修改文件计算前后 diff",
      "/clear 和 /memory 斜杠命令",
    ],
  },
  {
    version: "v0.6",
    date: "2026-03-28",
    tag: "perf",
    title: "preselect_skills：N 次串行 LLM 调用 → 1 次批量调用",
    body: "所有 section 的 skill 选择原来是 N 次独立 LLM 调用。现在合并为单次批量调用，同时处理所有 section。",
    items: [
      "无论 section 数量多少，只需一次 LLM 调用",
      "菜单/菜谱分离：选择阶段只看 metadata，生成阶段才加载完整 prompt",
      "LLM 失败时降级到每个类型的默认 skill",
      "8 个 section 的网站节省约 13 秒",
    ],
  },
  {
    version: "v0.6",
    date: "2026-03-24",
    tag: "major",
    title: "风格技能系统",
    body: "用户现在可以在生成前通过 prompt 输入框中的斜杠命令注入视觉风格指南。",
    items: [
      "/minimal、/bold、/glassmorphism、/brutalist 四种技能",
      "styleGuide 存储在 sessionStorage，仅传递给 generateProjectDesignSystem",
      "截断到 1200 字符，避免 analyzeProjectRequirement prompt 溢出",
      "useSlashMenu hook — 在 HeroPrompt 和 BuildConversation 中复用",
    ],
  },
  {
    version: "v0.5",
    date: "2026-03-18",
    tag: "major",
    title: "plan_project + generate_design_system 并行化",
    body: "两个步骤都只依赖 blueprint 且互不依赖。并行执行节省一个完整的 LLM round-trip。",
    items: [
      "Promise.all([stepPlanProject, stepGenerateProjectDesignSystem])",
      "每次生成节省约 10-20 秒",
      "安全检查：误放在 layoutSections 中的非 layout section 自动移回首页",
    ],
  },
  {
    version: "v0.5",
    date: "2026-03-17",
    tag: "major",
    title: "buildSteps 增量持久化",
    body: "构建步骤现在在每步完成后立即写入 Supabase，而非最后统一写入。用户中途关闭页面后重新进入能看到真实进度。",
    items: [
      "appendBuildStep() 通过 SSE onStep 回调逐步调用",
      "重新进入进行中的项目时启动 3 秒轮询",
      "重试时清空 buildSteps 防止幽灵节点",
      "projectId 在 AI 启动前创建 — 支持恢复和可分享 URL",
    ],
  },
  {
    version: "v0.4",
    date: "2026-03-10",
    tag: "perf",
    title: "E2B 沙箱重连 + 静态导出策略",
    body: "预览沙箱现在会重连已有的 E2B 实例而非创建新的。静态导出替代 next dev，提供稳定、低资源的预览 URL。",
    items: [
      "sandbox_id 持久化到 DB 用于重连",
      "next build + npx serve out 替代 next dev",
      "批量文件上传（20 个/批，并行）",
      "智能依赖安装：只安装模板中缺失的包",
      "rebuildDevServer 复用沙箱，跳过未变更文件的重新上传",
    ],
  },
  {
    version: "v0.3",
    date: "2026-03-01",
    tag: "major",
    title: "Blueprint normalize 层 + web_search 工具",
    body: "analyze 步骤现在能优雅地处理 LLM 输出不一致的问题，并可以搜索网络获取未知品牌名信息。",
    items: [
      "asProjectBlueprint() 对所有字段做类型化 normalize 和 fallback",
      "支持嵌套、扁平和单页三种 LLM 输出格式",
      "web_search 工具：prompt 包含未知专有名词时自动触发",
      "analyze 步骤最多 4 次工具调用迭代",
    ],
  },
  {
    version: "v0.2",
    date: "2026-02-15",
    tag: "fix",
    title: "原生 fetch 替代 OpenAI SDK",
    body: "OpenAI SDK 的 8 秒 socket timeout 会杀死长时间的 section 生成调用。替换为原生 fetch + AbortSignal.timeout(300_000)。",
    items: [
      "AbortSignal.timeout(300_000) — 5 分钟硬上限",
      "兼容任何 OpenAI-compatible 提供商（Gemini、本地 Ollama 等）",
      "不再出现 60 秒 section 生成调用的静默断连",
    ],
  },
];

const TAG_STYLES: Record<ChangeEntry["tag"], string> = {
  major: "bg-primary/15 text-primary border-primary/20",
  minor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  perf: "bg-green-500/15 text-green-400 border-green-500/20",
  fix: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/changelog",
    seoKey: "changelog",
  });
}

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("changelogPage");
  return (
    <main className="relative min-h-screen ">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          {t("subtitle")}
        </p>
        {t("entryLangNote") ? (
          <p className="mt-2 text-[12px] text-muted-foreground/70">{t("entryLangNote")}</p>
        ) : null}

        <div className="mt-12 space-y-0">
          {CHANGELOG.map((entry, i) => (
            <div key={`${entry.version}-${i}`} className="relative flex gap-6">
              <div className="flex flex-col items-center">
                <div className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background shrink-0" />
                {i < CHANGELOG.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-white/8 min-h-[2rem]" />
                )}
              </div>

              <div className="pb-12 min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[13px] font-bold text-foreground">{entry.version}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] ${TAG_STYLES[entry.tag]}`}>
                    {entry.tag}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground/40">{entry.date}</span>
                </div>

                <h2 className="mt-2 text-[16px] font-semibold tracking-tight">{entry.title}</h2>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{entry.body}</p>

                <ul className="mt-3 space-y-1.5">
                  {entry.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-[12px] text-muted-foreground/80">
                      <span className="mt-2 h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 mt-4">
          <Link
            href="/docs"
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t("docsCta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
