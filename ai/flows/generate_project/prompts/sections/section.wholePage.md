## Section 生成规范 — Whole-Page（单一主交互产品）

此文件用于在 `layoutMode: whole-page` 下**替代**通用 `section.default` 指引：一个 section 文件要实现该路由的**完整交互产品**——无论简报描述的是工具、游戏、信息流、管理台、创作工作台等任何类型。它**不是**长篇 **Line A** 营销页面中的一个区块。

### 这意味着什么

- **不是** Hero / feature / testimonial / CTA 的堆叠。这个组件本身就是产品；请把 **Section Design Brief** 与 `intent` / `contentHints` 视作产品规格。
- 最外层根节点应使用 `**min-h-screen`** 并填满视口壳层；**内部**区域可滚动（如 feed、表格、设置区）——遵循真实应用常见模式。
- **Client vs Server**：当界面需要浏览器 API、`useState` / `useRef` / `useEffect` / `useCallback`、事件处理、Web Audio、Canvas、`requestAnimationFrame`、游戏循环或其他非平凡交互时，文件顶部应加 `**"use client"`**。对于多数 whole-page 产品，只有静态壳层且缺乏真实交互视为失败。
- `section.default` 中用于“营销 section”的文案密度上限（限制标题/正文长度）**不适用于**主工具/游戏/仪表 UI。应使用该产品真实所需、清晰可读的文本量（标签、表头、帮助文案、游戏内提示等）。仍需避免冗长 lorem，优先使用具体、可信的产品文案。

### 布局语汇（按需使用，不要强行套 app chrome）

- **App-shell 类型产品**：顶部栏、侧边导航、主内容列、右侧面板、底部栏——按常规产品结构组织。
- **Full-stage / full-canvas 类型产品**：应包含**主舞台**（如 `canvas` 或全幅交互区域）与简报要求的**控制区 / HUD / 工具条**——除非简报明确要求，否则不要做成“三列等宽营销卡片”。

### 数据与可操作性

- Mock 数据应按简报要求体现**充实且可信**的内容形态（列表、行、实体、tile、表记录等），**不要**只有一个空卡片加标题。
- 若产品语义包含音频、物理或时间机制，可使用**简化且适合浏览器**的实现（如 `AudioContext`、简单节拍计时器）；除非简报明确要求，不要声称依赖外部服务或真实多人联机。

### 仍需遵循（共享护栏 + 设计系统）

- 遵守项目的**语言**规则：所有面向用户的字符串必须使用项目语言。
- 保持 DOM、`window`/`document`、canvas `getContext`、refs 的 **TypeScript / SSR 安全**，要求同 `section.default`。
- **不要**添加页面级固定颗粒/噪点/暗角遮罩；**不要**使用 `<style jsx>`。遵守系统提示中的 **outputTsx** 与可访问性护栏。
- 图片相关：当简报需要摄影/插画类资产时使用 `generate_image`；许多 **Line B** 场景是**纯 UI**（不需要图片）。

### 文件内组合方式

- 为保持主导出清晰，单文件中可包含**小型展示型子组件**；除非简报明确存在多个大型区域，否则避免过度拆分。
- **层次与节奏**：即使在单文件中，也应为主要区域（主区 vs chrome vs 面板）使用不同的**背景/表面** token，让结果读起来像真实产品，而非一整块扁平 `bg-background`——除非简报要求极简 chrome。

### 本模式的反模式

- 除非用户要做的产品本身就是如此，否则**不要**把整个文件降级成“通用营销 Hero + 三排图标”。
- 对于工具/游戏/shell UI，**不要**默认做成全居中、`max-w-prose` 的大段文案块。
- **不要**因为“server component first”的惯性而省略简报明确要求的交互——需要时就使用 `use client`。

