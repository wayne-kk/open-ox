"use client";

/** 快速模板：整页首页级 brief（多区块），覆盖科技 / 人文 / 社区等场景，便于试不同站点气质。 */
const TEMPLATES = [
  {
    label: "AI 工具首页",
    prompt:
      "做一个面向团队的生产力 AI 产品官网首页（单页）：开篇说明定位与一句话价值主张；接着三块核心能力配短说明与图标；一段客户标志或数据背书；产品界面示意或动效占位；定价或「预约演示」入口；底部常见问题与页脚链接。整体偏科技、可信、留白充足。",
  },
  {
    label: "人文艺术机构",
    prompt:
      "做一个美术馆 / 独立出版社的官网首页：顶部展览或当期主推视觉与标题；下一屏是本期展览/书目拆成卡片叙事；再往下是开放时间、地址与交通一句话；通讯员订阅入口；最后是合作伙伴与极简页脚。整体偏人文、纸质与印刷质感、排版克制。",
  },
  {
    label: "兴趣社区首页",
    prompt:
      "做一个泛兴趣社区的落地首页（单页）：英雄区邀请注册/下载，一句话讲清圈子氛围；一屏展示热门话题或帖子卡片流预览（只读示意）；一屏说明小组/活动玩法；用户证言或成员数字；注册 CTA；页脚含条款与社区准则入口。年轻、有活力但不杂乱。",
  },
  {
    label: "开发者平台",
    prompt:
      "做一个 API 与 SDK 为主的开发者产品首页：首区代码片段或终端气质 + 主标题；核心接口能力三条；文档与 GitHub 跳转突出；集成步骤或多语言标签；按用量阶梯的简易定价表；页脚文档地图。深色或明暗对比强、 monospace 点缀。",
  },
  {
    label: "独立创作者",
    prompt:
      "做一个音乐人或视频创作者的个人品牌首页：强势主视觉与艺名；作品列表或播放列表栅格；近期演出/更新日程一条；社交链接排成一行；合作/商务联系按钮；尾区版权与平台外链。偏情绪与故事感，节奏像在讲故事而不是卖软件。",
  },
  {
    label: "可持续与公益",
    prompt:
      "做一个环保或公益议题的机构首页：开篇一句使命与主图；项目进展用时间线或数字影响力（植树量、受众等）；志愿者/捐款双路径入口；近期故事两篇卡片；透明年报或报告下载链接；页脚支付方式与资质说明。温暖、克制、可信赖。",
  },
];

interface QuickTemplatesProps {
  onSelect: (prompt: string) => void;
  visible: boolean;
  /** single horizontal row; use with parent overflow-x-auto */
  layout?: "wrap" | "row";
}

export function QuickTemplates({ onSelect, visible, layout = "wrap" }: QuickTemplatesProps) {
  if (!visible) return null;

  const row = layout === "row";

  return (
    <div className={row ? "flex flex-nowrap items-center gap-1.5" : "flex flex-wrap gap-1.5"}>
      {TEMPLATES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onSelect(t.prompt)}
          className={`rounded-full border border-border bg-muted/40 font-mono text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary ${row ? "shrink-0 px-2.5 py-1 sm:px-3" : "px-3 py-1"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
