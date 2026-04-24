"use client";

/** 快速模板：文案刻意对齐 `ai/flows/.../hero/*.yaml` 的 designKeywords，便于触发不同 hero skill 做联调。 */
const TEMPLATES = [
  {
    label: "深空 fintech 星场",
    prompt:
      "做一个 fintech 机构落地页，Hero 要深空空间歌剧感：全屏近黑场域、细星场点阵、右下角巨大行星或地平线光弧（horizon glow）、轨道感 orbital、mission control 气质，叠加大字号与 mono 小字 telemetry。背景用纯 CSS+DOM 实现星点与柔边行星/光晕与少量滚动视差，不要 Three/WebGL/粒子/Canvas。",
  },
  {
    label: "杂志户外竖条分屏",
    prompt:
      "做一个户外/探险装备品牌单页，Hero 要 editorial 杂志大标题 + 全宽黑白 landscape 图，右侧是竖向 venetian 分条百叶窗、同一长图分 slice 的 parallax 微动。整体 heritage、grayscale 胶片感，可叠一层极淡 paper noise。禁止 WebGL/Shader/光球/星场；以摄影与分栏排版为主。",
  },
  {
    label: "夜光软球体氛围",
    prompt:
      "做一个夜间模式创意工具/笔记 App 落地页，Hero 要深色底上几颗大面积模糊彩色光球、mix-blend 叠加柔光、ambient 氛围、bokeh 感、dense 大字标题与副文案。可 difference 顶栏。用 CSS 全屏 orbs+screen 混合，不要 WebGL/Three/竖条/星场/行星。",
  },
  {
    label: "圆角卡内企业 Shader",
    prompt:
      "做一个 B2B 控制面 / infrastructure 产品单页，Hero 是一块大屏圆角 bento 视窗、外围 gradient frame 细亮边、内屏全黑底上 WebGL+GLSL 噪声流场+屏幕混合叠色，上覆玻璃态文案；标题需 scroll reveal 错开入场。要 enterprise、glassmorphism、control plane 气质，不要粒子星球模型与百叶窗分条。",
  },
  {
    label: "全屏肋条玻璃+网关",
    prompt:
      "做一个 biotech/实验室/网络 network gateway 品牌首屏：全视口 full-bleed、暗绿 void、中央用全屏正交四边形+GLSL 做竖向 reeded/肋条玻璃折射与光斑，左侧 SVG 标+竖线+短眉题。要 immersive 与 futuristic，不要圆角 bento 卡片、不要 GSAP 逐词幕帘、不要真实照片分条。",
  },
  {
    label: "监控台 V 形条+玻璃",
    prompt:
      "做一个数据平台/自动化 devtool 的 enterprise 落地页，Hero 为 deep black 底、动态 V 形渐变光带条、中央 faceted 玻璃感立体件、system monitoring 与 ai workflow 气质，futuristic 但克制。用 Three 场景与背景条协同，不要吸积盘粒子盘、不要星场行星、不要圆角 bento 内嵌卡大窗。",
  },
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
