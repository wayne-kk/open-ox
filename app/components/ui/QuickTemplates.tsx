"use client";

/** 快速模板：简短产品需求描述，便于试不同 Hero 气质（与 hero skills 自然对应，不堆砌技术禁令）。 */
const TEMPLATES = [
  {
    label: "星夜科技品牌",
    prompt:
      "金融科技品牌落地页首屏：深色全屏，远处柔和光带与星点，右下角朦胧的星球轮廓，轻滚动视差，大标题配一行简短说明，整体冷静、有太空叙事感。",
  },
  {
    label: "户外杂志风",
    prompt:
      "户外装备品牌单页首屏：全宽风景照片，杂志式大标题，画面一侧用竖条分割并带轻微错层动感，低饱和或黑白，有一点胶片颗粒感。",
  },
  {
    label: "夜间氛围工具",
    prompt:
      "笔记或创意工具的产品首页首屏：深色背景，几团柔和的彩色光晕铺开氛围，中间是产品名和一句话介绍，适合夜间模式、偏安静的情绪。",
  },
  {
    label: "企业控制台",
    prompt:
      "B2B 数据或基础设施产品首屏：中间一块大圆角视窗，外圈细腻的渐变亮边，窗内深色底上用 WebGL 做缓慢流动的抽象背景，文案半透明玻璃质感，主按钮清晰。",
  },
  {
    label: "实验室网关感",
    prompt:
      "生物科技或网络设备公司首页首屏：整屏深色，用 WebGL 做竖条纹玻璃的折射与柔和高光、缓慢变化，左侧小 Logo 和一句短 slogan，专业、沉浸、偏未来感。",
  },
  {
    label: "数据监控台",
    prompt:
      "数据平台或自动化工具落地页首屏：近黑背景，用 WebGL 做有层次的 V 形光带缓慢流动，像监控大屏的气质，排版克制，突出一句价值主张和两个按钮。",
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
