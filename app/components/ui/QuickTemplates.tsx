"use client";

const TEMPLATES = [
  { label: "高视觉 SaaS 单页", prompt: "做一个高视觉冲击力的 SaaS 单页面，深色渐变 + 3D 光效 Hero、功能亮点、社证、价格与 CTA，整体保持强节奏和高级质感" },
  { label: "品牌故事单页", prompt: "做一个高视觉品牌故事单页面，电影感大图、时间线叙事、核心价值、团队与行动召唤，突出品牌气质和情绪表达" },
  { label: "发布会风格单页", prompt: "做一个新品发布会风格单页面，超大标题、滚动分镜、卖点模块、规格对比和购买入口，强调舞台感与科技感" },
  { label: "作品集展示单页", prompt: "做一个高视觉设计师作品集单页面，沉浸式封面、精选项目卡、能力标签、客户评价与联系区，整体简洁但有冲击力" },
  { label: "电商活动单页", prompt: "做一个高视觉电商活动单页面，主视觉 Banner、爆款瀑布流、限时倒计时、优惠机制和下单入口，强化活动氛围和转化导向" },
  { label: "数据产品营销单页", prompt: "做一个高视觉数据产品营销单页面，动态图表背景、价值指标、场景方案、技术可信背书与注册 CTA，兼顾专业感和未来感" },
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
