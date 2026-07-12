/**
 * Compliant competitor comparison copy.
 * Rules: nominative fair use of brand names; no logos; no affiliation claims;
 * acknowledge competitor strengths; base claims on public product positioning;
 * show last-updated date.
 */

export type CompetitorSlug = "lovable" | "v0" | "base44";

export type CompareRow = {
  dimension: { "zh-CN": string; en: string };
  openOx: { "zh-CN": string; en: string };
  other: { "zh-CN": string; en: string };
};

export type CompetitorCompare = {
  slug: CompetitorSlug;
  name: string;
  officialUrl: string;
  lastUpdated: string;
  /** Honest one-liner of what they do well (public positioning). */
  theirStrength: { "zh-CN": string; en: string };
  openOxAngle: { "zh-CN": string; en: string };
  rows: CompareRow[];
  whenOpenOx: { "zh-CN": string; en: string };
  whenOther: { "zh-CN": string; en: string };
};

export const COMPETITORS: CompetitorCompare[] = [
  {
    slug: "lovable",
    name: "Lovable",
    officialUrl: "https://lovable.dev",
    lastUpdated: "2026-07-12",
    theirStrength: {
      "zh-CN":
        "以对话驱动的应用生成体验成熟，上手快，适合快速出可交互原型与产品雏形。",
      en: "Mature chat-to-app experience and fast time-to-interactive prototype for product sketches.",
    },
    openOxAngle: {
      "zh-CN":
        "Open-OX 侧重可运行的 Next.js 站点工程：固定生成流水线、Studio 迭代、Design Mode 直改源码，以及社区发布 / Remix 与自有 Vercel 部署。",
      en: "Open-OX focuses on runnable Next.js site engineering: a fixed generation pipeline, Studio iteration, Design Mode source edits, community publish/remix, and BYO Vercel deploy.",
    },
    rows: [
      {
        dimension: { "zh-CN": "主要输出", en: "Primary output" },
        openOx: {
          "zh-CN": "可构建的 Next.js 站点工程（非截图原型）",
          en: "Buildable Next.js site project (not a screenshot mock)",
        },
        other: {
          "zh-CN": "对话生成的应用 / 产品界面（以各自产品文档为准）",
          en: "Chat-generated apps / UI (see their product docs)",
        },
      },
      {
        dimension: { "zh-CN": "迭代方式", en: "Iteration" },
        openOx: {
          "zh-CN": "Studio 对话修改 + Design Mode 点选直改源码",
          en: "Studio chat modify + Design Mode click-to-patch source",
        },
        other: {
          "zh-CN": "以对话与产品内编辑为主（公开能力随版本变化）",
          en: "Primarily chat and in-product editing (public features evolve)",
        },
      },
      {
        dimension: { "zh-CN": "验证", en: "Verification" },
        openOx: {
          "zh-CN": "流水线含构建验证与自动修复轮次",
          en: "Pipeline includes build verification and repair loops",
        },
        other: {
          "zh-CN": "依产品内预览与发布流程（以官方说明为准）",
          en: "In-product preview / publish flows (see official docs)",
        },
      },
      {
        dimension: { "zh-CN": "部署", en: "Deploy" },
        openOx: {
          "zh-CN": "社区静态预览 + 可选推送到你自己的 Vercel 账号",
          en: "Community static preview + optional push to your own Vercel account",
        },
        other: {
          "zh-CN": "产品内托管 / 发布选项（以官方为准）",
          en: "In-product hosting / publish options (see official docs)",
        },
      },
    ],
    whenOpenOx: {
      "zh-CN":
        "你需要可检查、可改的真实前端工程，并希望在 Studio 里持续迭代到可交付。",
      en: "You want inspectable, editable real frontend engineering and Studio iteration until shippable.",
    },
    whenOther: {
      "zh-CN": "你优先要极速对话出原型，且接受对方产品内的默认工作流与托管形态。",
      en: "You prioritize fastest chat-to-prototype and prefer their default in-product workflow and hosting.",
    },
  },
  {
    slug: "v0",
    name: "v0",
    officialUrl: "https://v0.dev",
    lastUpdated: "2026-07-12",
    theirStrength: {
      "zh-CN":
        "Vercel 生态内的 UI / 组件生成能力强，适合把设计意图快速落成 React 组件。",
      en: "Strong UI/component generation in the Vercel ecosystem for turning design intent into React components quickly.",
    },
    openOxAngle: {
      "zh-CN":
        "Open-OX 面向「整站」：从需求到多页站点、设计系统、构建验证与 Studio 持续修改，而不是单次组件草稿。",
      en: "Open-OX targets full sites: requirements → multi-page sites, design system, build verification, and ongoing Studio edits — not a one-shot component draft.",
    },
    rows: [
      {
        dimension: { "zh-CN": "工作范围", en: "Scope" },
        openOx: {
          "zh-CN": "站点级流水线（规划 → 页面实现 → 构建）",
          en: "Site-level pipeline (plan → pages → build)",
        },
        other: {
          "zh-CN": "偏组件 / UI 生成与组合（以 v0 官方为准）",
          en: "Component / UI generation and composition (see v0 docs)",
        },
      },
      {
        dimension: { "zh-CN": "产品壳", en: "Product shell" },
        openOx: {
          "zh-CN": "Workspace、Studio、社区、积分与部署集成",
          en: "Workspace, Studio, community, credits, and deploy integrations",
        },
        other: {
          "zh-CN": "生成器工作台，嵌入更广的 Vercel 工作流",
          en: "Generator workbench that fits broader Vercel workflows",
        },
      },
      {
        dimension: { "zh-CN": "源码迭代", en: "Source iteration" },
        openOx: {
          "zh-CN": "Design Mode 按源坐标直改 + Modify Agent",
          en: "Design Mode source-coordinate patches + Modify Agent",
        },
        other: {
          "zh-CN": "在生成结果上继续提示 / 导出到项目（以官方为准）",
          en: "Continue prompting on results / export into projects (see official docs)",
        },
      },
    ],
    whenOpenOx: {
      "zh-CN": "目标是完整营销站 / 多页站点，并要一条龙生成与验证。",
      en: "You need a full marketing or multi-page site with end-to-end generation and verification.",
    },
    whenOther: {
      "zh-CN": "你已有应用骨架，主要缺高质量 UI 组件草稿。",
      en: "You already have an app skeleton and mainly need high-quality UI component drafts.",
    },
  },
  {
    slug: "base44",
    name: "Base44",
    officialUrl: "https://base44.com",
    lastUpdated: "2026-07-12",
    theirStrength: {
      "zh-CN":
        "定位于 AI 应用构建，强调用自然语言快速得到可运行应用（以官方产品说明为准）。",
      en: "Positioned as an AI app builder for turning natural language into runnable apps (see their product materials).",
    },
    openOxAngle: {
      "zh-CN":
        "Open-OX 更聚焦网站交付：Next.js 工程输出、Studio 精修、社区发现与可选自有账号部署。",
      en: "Open-OX is more website-delivery focused: Next.js project output, Studio refinement, community discovery, and optional BYO-account deploy.",
    },
    rows: [
      {
        dimension: { "zh-CN": "交付物", en: "Deliverable" },
        openOx: {
          "zh-CN": "可预览、可改的站点源码工程",
          en: "Previewable, editable site source project",
        },
        other: {
          "zh-CN": "AI 应用构建产物（形态以官方为准）",
          en: "AI app-builder output (shape per their product)",
        },
      },
      {
        dimension: { "zh-CN": "协作 / 发现", en: "Collab / discovery" },
        openOx: {
          "zh-CN": "Publish Preview 社区列表 + Remix 拷贝许可轴",
          en: "Publish Preview community listing + Remix copy-license axis",
        },
        other: {
          "zh-CN": "依其产品内分享与协作能力（公开资料）",
          en: "In-product sharing/collaboration as publicly documented",
        },
      },
      {
        dimension: { "zh-CN": "部署控制", en: "Deploy control" },
        openOx: {
          "zh-CN": "可推到作者自己的 Vercel，不绑定单一托管叙事",
          en: "Optional push to the author’s own Vercel — not a single-host lock-in story",
        },
        other: {
          "zh-CN": "产品默认托管 / 发布路径（以官方为准）",
          en: "Default product hosting / publish path (see official docs)",
        },
      },
    ],
    whenOpenOx: {
      "zh-CN": "你要的是网站工程与可审计的前端交付，而不是泛化「应用生成器」叙事。",
      en: "You want website engineering and auditable frontend delivery, not a generic “app generator” narrative.",
    },
    whenOther: {
      "zh-CN": "你的主场景是更宽的 AI 应用构建，且更贴合对方产品默认路径。",
      en: "Your primary job is broader AI app building that fits their default product path better.",
    },
  },
];

export function getCompetitor(slug: string): CompetitorCompare | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export function pickLocale<T extends Record<"zh-CN" | "en", string>>(
  value: T,
  locale: string
): string {
  return locale === "en" ? value.en : value["zh-CN"];
}
