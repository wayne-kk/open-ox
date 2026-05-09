## 规则：区块（Section）布局

### 双层结构

- **外层**：`w-full` —— 仅用于背景色/背景图/渐变。不要圆角、边框、阴影。
- **内层**：`container mx-auto px-6 md:px-8`，并按区块设定纵向节奏。内层不要嵌套 `max-w-*`。

### 纵向节奏（严格）

- Hero：`py-16 md:py-20`。
- 常规内容区块：`py-12 md:py-16`（默认）。
- 紧凑/辅助区块（数据条、FAQ、Logo 墙）：`py-10 md:py-16`。
- 收尾 CTA 区块：`py-16 md:py-20`。
- 不要叠加 `pt-*` 与 `pb-*` 使得等效间距超过 `py-24`，除非 section brief 明确要求。
- 常规营销页避免通篇使用 `py-32` / `py-40` 这类过大上下留白。
- 生成代码中区块外层**禁止**使用的类名模式：`py-32`、`py-40`、`md:py-32`、`md:py-40`、`lg:py-32`、`lg:py-40`。

### 区块之间的分隔

优先用**表面（surface）对比**（浅色 ↔ secondary/muted 浅 tint ↔ 深色 `bg-foreground` 条带）制造断档，而不是用线条规则铺满。

- 默认：区块之间不要用 `border-b`、`divide-y`、`<hr />` 或浓重阴影当作每一段的分界。
- 仅当两个相邻区块在视觉上会糊成同一块时，才允许：一条细的 `border-t border-border/30`，**或者**在 logo/媒体条区域使用内层 **条带容器**（`rounded-2xl border border-border/50 bg-secondary/20`）——不要把「通栏细线」用在每一个 section 上。

### 结构一致性

- 避免连续 3 个以上 section 使用完全相同的内层栅格模式。
- 若某一 section 使用了 `grid` 两栏分屏，下一 section 默认应改为居中堆叠或不同的栅格比例，除非 brief 要求视觉连续。
