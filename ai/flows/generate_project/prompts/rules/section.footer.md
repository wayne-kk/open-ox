## Section 提示词：生成页脚 Section（Step Detail）

生成一个全局可复用的站点页脚组件，响应式、与设计系统一致，并承接 layout 中的文档流布局（配合 `main` 的 `flex-1` 等，将页脚自然置于页面底部）。

## Next.js App Router（必守）

- 本组件由根 `app/layout.tsx`（或 chrome 壳层）引入；父级多为 **Server Component**。若页脚含 `useState`、`useEffect`、`onClick`、`useRef`、浏览器 API、订阅表单等客户端逻辑：**文件第一行**（位于所有 `import` 之前）**必须**为：

  `"use client";`

  纯展示、无上述客户端 API 时可为 Server Component，此时**不要**写 `"use client";`。

- **禁止使用 `styled-jsx`**：不要写 `<style jsx>`、不要 `import "styled-jsx/..."`。页脚样式**只**用 **Tailwind `className`**（与设计系统一致）。

## 必备结构

1. 品牌或站点名称（可与导航一致，保持克制）。
2. 桌面端分组链接（可选，视产品而定）。
3. 版权或年份占位一行（可用 © + 产品名，不编造公司实体）。
4. 移动端：链接分组可折叠或单列堆叠，保持可读与可达性。
5. 若与顶栏并存，页脚的语气和密度应**低于**主导航，避免重复堆砌同一组链接。

## 定位与布局规则

- 页脚应在 **正常文档流** 中处于主内容之后；由 **layout** 使用列向 flex（如 `flex min-h-dvh flex-col`）+ **`main` 撑满剩余高度**（如 `flex-1`）把页脚推到底，**不要**用 `fixed` / `sticky bottom` 把整栏页脚钉在视口上（除非产品明确需要始终可见的工具条，且需保留安全区与可滚动主区）。
- **不要**用兄弟元素上的 **`padding-top` / `margin-top` 类**去「补偿」页脚或主区高度；间距用**组内**的 `gap`、`space-y`、`py`、`pt`（仅页脚容器内部）、或 grid/flex 的 `gap` 表达。
- 页脚根元素优先使用语义化 **`<footer>`**，并保证在 landmark 顺序上位于 `main` 之后（或与设计系统等价的区域结构）。

## 页脚链接 — 严格规则

- **只能使用提示上下文中 "Known Routes" 列出的路由。** 不得新增、臆造或假设任何其他页面、分区或目标地址。
- 若站点只有一个页面（例如只有 `/`），页脚外站链接组应极简或省略——禁止伪造 “About”“Blog”“Contact”“Pricing” 等整块链接矩阵。
- 链接文案应与 Known Routes 中的页面标题或约定一致；`href` 必须是提供的精确路由路径。
- 若某路由 slug 为 `"home"`，其路径应为 `/`。

## 其他规则

- 仅在真实交互需求下使用 hooks；不要为了凑齐 pattern 强行客户端化。
- 保持浅色/深色模式下对比度与焦点环可用；不要堆砌装饰性全宽背景图替代 `globals.css` 的 token 纸面。
