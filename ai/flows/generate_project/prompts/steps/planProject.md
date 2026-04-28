## 步骤提示词：Plan Project — 分段页面（Split Sections）

该页面是一个自上而下滚动浏览的长页，由多个内容区块堆叠组成。

### 你需要产出什么

1. 保持结构为合法 JSON。
2. 为每个 page 附加 `pageDesignPlan`。
3. 每个 section 仅需包含：`type`、`intent`、`contentHints`、`fileName`。

### 单页规则（关键）

- 本流水线只生成一个页面（`slug: "home"`）。
- 不要虚构额外页面/路由。
- 导航请使用页内锚点。

### sections 边界（关键）

- 本步骤只规划 `pages[].sections` 的内容 section。
- 共享壳层信息（如 navigation/footer）不在本步骤输出范围内。

---

### Section 数量

- 总 section 数必须为 **3–4 个**（含开场与收尾）。少而强优于多而散。
- 3 个 section：紧凑有力——适合单一信息活动页、个人作品集。
- 4 个 section：标准配置——适合多功能产品、电商、内容较丰富的网站。

除非用户明确要求，否则在 `pageDesignPlan` 的文案中体现相近的强度：**设计变化度偏高、动效中等、信息密度中等**（写入 `layoutStrategy` / `constraints`，不要用单独的 1–10 数字字段）。

---

### Section 原型库（Line A，可复用但非封闭列表）

以下名称是滚动页面的**可复用构建块**，并非唯一可选类型。
如果用户需求更适合其他 `type` 命名，应优先使用**忠实于项目语义**的名称，而不是硬套默认套路。

不要对所有产品都默认 `Hero → Feature → Testimonial → CTA`。
请根据实际内容选择组合。

**开场（第一屏，必需）**
- `Hero` — 全幅品牌主张 + 主 CTA
- `ProductHero` — 产品导向开场：视觉 + 关键信息 + 购买/试用动作
- `EventHero` — 日期、地点、主标题、购票 CTA
- `EditorialHero` — 杂志风分栏：大图 + 标题 + 副文案
- `Manifesto` — 强宣言式单主题开场，文案极简

**内容 / 证据**
- `Feature` — 能力说明，2–4 项网格或分栏
- `BentoGrid` — 非对称卡片展示，不同尺寸卡片
- `Metrics` — 核心数据带（3–5 个指标）
- `Timeline` — 时间线、里程碑、流程节点
- `Workflow` — 编号步骤说明产品如何运作
- `Comparison` — 对比表
- `Integration` — 生态/合作工具 logo 或图标
- `LogoWall` — 客户/合作方/媒体 logo 墙
- `Gallery` — 图片/视频网格（作品、lookbook、媒体素材）
- `VideoShowcase` — 嵌入或模拟视频播放器 + 配套文案
- `CodeShowcase` — 面向开发者产品的代码展示
- `MapEmbed` — 地图 + 地址 + 营业时间

**社会证明**
- `Testimonial` — 1–3 条评价（含身份与头像）
- `CaseStudy` — 案例叙事：挑战 → 方案 → 结果
- `ReviewGrid` — 星级评分 + 短评卡片
- `PressLogos` — “媒体报道”logo 带
- `AwardsBand` — 认证、奖项、可信背书

**转化 / 行动**
- `Pricing` — 2–3 档价格卡
- `CTA` — 收尾行动带
- `Newsletter` — 邮件订阅模块
- `WaitlistForm` — 候补名单表单 + 社会证明计数
- `ContactForm` — 表单 + 联系信息分栏
- `Download` — 应用商店徽章或下载入口

**内容 / 编辑型**
- `ArticleGrid` — 文章卡片网格（图 + 标题 + 日期 + 标签）
- `FeaturedPost` — 单篇重点内容展示
- `CategoryBand` — 横向滚动分类标签带
- `TagCloud` — 主题标签云
- `AuthorBio` — 作者简介 + 社交链接
- `TableOfContents` — 锚点目录

**电商**
- `ProductGrid` — 商品卡（图 + 名称 + 价格 + 加购）
- `CategoryGrid` — 顶层分类导航
- `CartSummary` — 购物车汇总
- `ProductSpecs` — 参数规格表

**团队 / 关于**
- `Team` — 团队成员网格
- `FounderStory` — 创始人故事
- `Values` — 价值观/文化支柱
- `JobBoard` — 招聘岗位列表 + 部门筛选

---

### intent 与 contentHints

- `intent`：该 section 在页面叙事中**要完成什么**（情绪、证据、任务、转场）。
- `contentHints`：该 section 中**可见且可扫描**的内容元素（具体证据单元、布局模式、图像处理方式）。必须包含动效建议（`none` / `subtle` / `emphasis`）与空间密度（`compact` / `standard` / `spacious`）。

### 节奏规则

- 视觉层次要有变化：至少一个高对比区块（深色或品牌色背景）。
- 布局模式要有变化：避免连续 3 个以上相同的居中堆叠或同构卡片网格。
- 至少一个 section 要“视觉强势”（全幅图、超大字号或强色彩）。
- 除开场外，每个 section 必须包含 ≥ 2 个不同内容单元（不能只有标题 + 按钮）。
- 弱小 section 要并入相邻 section，避免碎片化。

---

### 规划风格

- 以实现为导向，避免空泛策略语言。
- 不要在 section 上输出 `designPlan`。

### 输出约束

- 仅返回 JSON（不要 markdown）。
- `sections.length` 必须在 `3` 到 `4`（含边界）之间。
- 输出字段必须严格匹配下方“固定输出结构”；不要新增、重命名或省略必填字段。

### 固定输出结构（authoritative）

你的最终输出必须是**单个 JSON 对象**，结构固定为：

{
  "pages": [
    {
      "title": "Home",
      "slug": "home",
      "description": "延续输入 blueprint.site.pages[0].description 的单句定位",
      "journeyStage": "entry",
      "pageDesignPlan": {
        "pageGoal": "与本页 description 一致的单句目标",
        "narrativeArc": "建立价值 → 支撑证据 → 推动转化的节奏",
        "layoutStrategy": "用区块节奏与间距对比支撑该 journeyStage 的旅程阶段",
        "hierarchy": [
          "首屏快速建立情境与价值",
          "中段加深信任或说明方案",
          "末段降低阻力并强化行动"
        ],
        "constraints": [
          "保持给定 section 顺序",
          "避免区块节奏与密度重复",
          "动效与装饰克制，信息扫描优先"
        ]
      },
      "sections": [
        {
          "type": "hero",
          "intent": "开场叙事目标",
          "contentHints": "可见内容 + 布局 + 动效级别 + 间距密度",
          "fileName": "HeroSection"
        },
        {
          "type": "Feature",
          "intent": "中段证据目标",
          "contentHints": "可见内容 + 布局 + 动效级别 + 间距密度",
          "fileName": "FeatureSection"
        },
        {
          "type": "CTA",
          "intent": "收尾转化目标",
          "contentHints": "可见内容 + 布局 + 动效级别 + 间距密度",
          "fileName": "CtaSection"
        }
      ]
    }
  ]
}

字段规则（严格）：
- 顶层必须且只包含：`pages`。
- `pages` 必须且只能有 1 项，且 `slug` 必须为 `"home"`。
- `pageDesignPlan` 必须存在，键固定为：`pageGoal`、`narrativeArc`、`layoutStrategy`、`hierarchy`（字符串数组）、`constraints`（字符串数组）；均为非空、可执行的短句。
- `sections` 中每项仅允许：`type`、`intent`、`contentHints`、`fileName`。
- `sections.length` 必须在 3 到 4 之间（含边界）。
- `fileName` 统一使用 PascalCase + `Section` 后缀（如 `HeroSection`、`PricingSection`）。