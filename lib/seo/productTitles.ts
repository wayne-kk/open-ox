export type ProductTitleLocale = "en" | "zh-CN";

const TITLES = {
  auth: { en: "Sign in", "zh-CN": "登录" },
  dashboard: { en: "My Projects", "zh-CN": "我的项目" },
  community: { en: "Community", "zh-CN": "社区" },
  appearance: { en: "Appearance", "zh-CN": "外观设置" },
  integrations: { en: "Integrations", "zh-CN": "集成设置" },
  maintenance: { en: "System Maintenance", "zh-CN": "系统维护" },
  docs: { en: "Documentation", "zh-CN": "开发文档" },
} as const;

export type ProductTitleKey = keyof typeof TITLES;

const DOC_TITLES = {
  architecture: { en: "Architecture", "zh-CN": "系统架构" },
  pipeline: { en: "Generation Pipeline", "zh-CN": "AI 生成流水线" },
  designMode: { en: "Design Mode", "zh-CN": "Design Mode" },
  blueprint: { en: "Project Blueprint", "zh-CN": "项目蓝图" },
  normalize: { en: "Blueprint Normalization", "zh-CN": "Blueprint 容错解析" },
  designSystem: { en: "Design System Generation", "zh-CN": "设计系统生成" },
  sectionGeneration: { en: "Section Generation", "zh-CN": "Section 生成" },
  skills: { en: "Style Skills", "zh-CN": "风格技能" },
  modifyAgent: { en: "Modify Agent", "zh-CN": "修改 Agent" },
  preview: { en: "Preview Sandbox", "zh-CN": "预览沙箱" },
  storage: { en: "Storage", "zh-CN": "存储与持久化" },
  models: { en: "Models", "zh-CN": "模型" },
  api: { en: "API Reference", "zh-CN": "API 参考" },
  generationTrace: { en: "Generation Trace", "zh-CN": "项目生成追踪" },
} as const;
export type DocsTitleKey = keyof typeof DOC_TITLES;

const ADMIN_TITLES = {
  dashboard: { en: "Overview", "zh-CN": "数据概览" },
  acquisition: { en: "Acquisition", "zh-CN": "获客分析" },
  activation: { en: "Activation", "zh-CN": "激活分析" },
  engagement: { en: "Engagement", "zh-CN": "参与分析" },
  retention: { en: "Retention", "zh-CN": "留存分析" },
  generation: { en: "Generation", "zh-CN": "生成分析" },
  cost: { en: "Cost", "zh-CN": "成本分析" },
  users: { en: "Users", "zh-CN": "用户管理" },
  userDetail: { en: "User Details", "zh-CN": "用户详情" },
  projects: { en: "Projects", "zh-CN": "项目管理" },
  models: { en: "Models", "zh-CN": "模型管理" },
  settings: { en: "System Settings", "zh-CN": "系统设置" },
  queue: { en: "Queue", "zh-CN": "队列监控" },
  alerts: { en: "Alerts", "zh-CN": "告警管理" },
} as const;
export type AdminTitleKey = keyof typeof ADMIN_TITLES;

export function productTitleLocale(locale: string): ProductTitleLocale {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

export function productPageTitle(key: ProductTitleKey, locale: string): string {
  return `${TITLES[key][productTitleLocale(locale)]} · Open-OX`;
}

export function projectPageTitle(
  projectName: string | null | undefined,
  locale: string,
): string {
  const fallback = productTitleLocale(locale) === "zh-CN" ? "项目" : "Project";
  return `${projectName?.trim() || fallback} · Open-OX`;
}

export function previewPageTitle(
  projectName: string | null | undefined,
  locale: string,
): string {
  const language = productTitleLocale(locale);
  const name =
    projectName?.trim() || (language === "zh-CN" ? "项目" : "Project");
  const separator = language === "zh-CN" ? "：" : ": ";
  return `${language === "zh-CN" ? "预览" : "Preview"}${separator}${name} · Open-OX`;
}

export function docsPageTitle(key: DocsTitleKey, locale: string): string {
  return `${DOC_TITLES[key][productTitleLocale(locale)]} · Open-OX Docs`;
}

export function studioPageTitle(
  projectName: string | null | undefined,
  locale: string,
  state?: "generating" | "attention",
): string {
  const language = productTitleLocale(locale);
  const name =
    projectName?.trim() || (language === "zh-CN" ? "项目" : "Project");
  const colon = language === "zh-CN" ? "：" : ": ";
  if (state === "generating") {
    return `${language === "zh-CN" ? "生成中" : "Building"}${colon}${name} · Open-OX`;
  }
  if (state === "attention") {
    return `${language === "zh-CN" ? "需要处理" : "Needs attention"}${colon}${name} · Open-OX`;
  }
  return `${name} · Studio · Open-OX`;
}

export function adminPageTitle(key: AdminTitleKey, locale: string): string {
  return `${ADMIN_TITLES[key][productTitleLocale(locale)]} · Admin · Open-OX`;
}
