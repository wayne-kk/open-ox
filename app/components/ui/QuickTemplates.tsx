"use client";

const TEMPLATES = [
  { label: "新品发布倒计时会场", prompt: "做一个新品发布倒计时会场单页面，包含倒计时 Hero、核心卖点、规格对比、价格权益与立即预约 CTA。关键视觉必须用 WebGL（Three.js + GLSL fragment shader）实现舞台光束、能量扫光、bloom 发光和镜头推进过渡，禁止纯 CSS 替代核心效果。" },
  { label: "拉新裂变活动落地页", prompt: "做一个拉新裂变活动落地页，包含活动主 KV、任务进度、奖励阶梯、排行榜与分享引导。用 WebGL shader 构建霓虹流光、粒子爆发、hover 能量反馈与滚动动态背景场，核心氛围必须是实时渲染，不要降级为普通 CSS 动效。" },
  { label: "融资路演品牌官网", prompt: "做一个融资路演品牌官网单页面，包含品牌主张、增长数据、商业模式、团队背书与联系入口。使用 WebGL 渲染电影感光晕、体积光、微颗粒和镜头级转场，强化高端可信与科技感；关键视觉需基于 shader，不可纯 CSS 模拟。" },
  { label: "海外 SaaS 试用转化页", prompt: "做一个海外 SaaS 试用转化页，包含价值主张 Hero、功能模块、客户案例、定价与免费试用 CTA。要求 WebGL 驱动玻璃质感、动态反射、网格波动和鼠标视差追光，交互态有清晰能量反馈，禁止仅用 CSS 过渡实现核心视觉。" },
  { label: "AIGC 作品集招聘页", prompt: "做一个 AIGC 作品集招聘页，包含沉浸式封面、代表项目、技术栈、合作客户与联系通道。用 WebGL 做封面景深、卡片折射、噪声扰动和高光跟随，滚动时有分层视差与流光过渡，核心特效必须由 shader 提供。" },
  { label: "数据大屏产品招商页", prompt: "做一个数据大屏产品招商页，包含实时指标背景、行业场景方案、落地案例、技术可信背书与预约演示 CTA。要求 WebGL 实现数据流粒子、发光连线、动态网格与实时 shader 过渡，突出专业未来感，禁止纯 CSS 假特效。" },
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
