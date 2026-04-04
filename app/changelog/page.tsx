import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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

export default function ChangelogPage() {
  return (
    <main className="relative min-h-screen pt-[57px]">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // changelog
        </p>
        <h1 className="text-3xl font-bold tracking-tight">更新日志</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          工程决策、性能优化与新能力。
        </p>

        <div className="mt-12 space-y-0">
          {CHANGELOG.map((entry, i) => (
            <div key={`${entry.version}-${i}`} className="relative flex gap-6">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background shrink-0" />
                {i < CHANGELOG.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-white/8 min-h-[2rem]" />
                )}
              </div>

              {/* Content */}
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

        <div className="border-t border-white/8 pt-8 mt-4">
          <Link
            href="/docs"
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            查看完整文档
          </Link>
        </div>
      </div>
    </main>
  );
}
