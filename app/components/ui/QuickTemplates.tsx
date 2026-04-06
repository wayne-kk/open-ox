"use client";

const TEMPLATES = [
  { label: "SaaS 落地页", prompt: "一个现代化的 SaaS 产品落地页，包含 Hero、功能介绍、定价和 CTA" },
  { label: "个人作品集", prompt: "设计师个人作品集网站，带项目展示、关于我和联系方式" },
  { label: "电商首页", prompt: "电商网站首页，带商品展示、分类导航、促销 Banner 和购物车入口" },
  { label: "博客", prompt: "极简风格的个人博客，带文章列表、标签分类和关于页面" },
  { label: "仪表盘", prompt: "数据分析仪表盘，带图表、指标卡片、侧边栏导航" },
  { label: "餐厅官网", prompt: "餐厅官方网站，带菜单展示、在线预订、门店信息和图片画廊" },
];

interface QuickTemplatesProps {
  onSelect: (prompt: string) => void;
  visible: boolean;
}

export function QuickTemplates({ onSelect, visible }: QuickTemplatesProps) {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {TEMPLATES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onSelect(t.prompt)}
          className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-muted-foreground/60 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
