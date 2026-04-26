## Section 提示词：生成导航 Section

生成一个响应式顶部导航组件，要求可全局复用、
适配 sticky 场景，且视觉风格与设计系统一致。

## Next.js App Router（必守）

- 本组件由根 `app/layout.tsx` 引入；父级为 **Server Component**。**文件第一行**（位于所有 `import` 之前）**必须**为：

  `"use client";`

  不要省略：除 hooks / 事件外，使用 **`styled-jsx`**（如 `<style jsx>`）或其它走 `client-only` 的写法也会在默认 RSC 树下直接构建失败（Turbopack：`styled-jsx` / `client-only` cannot be imported from a Server Component）。

- **禁止使用 `styled-jsx`**：不要写 `<style jsx>`、不要 `import "styled-jsx/..."`。导航样式**只**用 **Tailwind `className`**（与设计系统一致）。

- 使用 `useState`、`useEffect`、`useRef`、`useCallback`、浏览器 API、或 `onClick` / `onChange` 等与上文一致：**仍**保持首行 `"use client";`。

## 必备结构

1. 品牌标识与站点名称。
2. 桌面端导航链接。
3. 主 CTA（仅当 Known Routes 中存在真实转化目标时才添加）。
4. 移动端菜单开关与移动端导航。
5. 若页面包含沉浸式 hero，需具备滚动感知样式。

## 定位规则

- 根导航元素**必须使用 `sticky top-0 z-50`**。禁止使用 `fixed` 或 `absolute` 定位。
- `fixed` 会让元素脱离文档流并遮挡下方内容；`sticky` 可保持文档流并避免布局跳变。
- 不要给兄弟元素添加 `padding-top` 或 `margin-top` 补偿——`sticky` 不需要。
- 确保导航根元素的父级没有 `overflow: hidden` 或 `overflow: auto`（会破坏 sticky）。导航应作为 layout shell 的直接子元素。

## 导航链接 — 严格规则

- **只能使用提示上下文中 "Known Routes" 列出的路由。** 不得新增、臆造或假设任何其他页面、分区或目标地址。
- 若站点只有一个页面（例如只有 `/`），导航链接必须为空或使用页内锚点——禁止伪造额外页面。
- 不要添加 “About”“Blog”“Contact”“FAQ”“Pricing”“Features”“Docs”“Support” 等链接，除非它们明确出现在 Known Routes 列表中。
- 导航项标签应与 Known Routes 中的页面标题一致；`href` 必须是提供的精确路由路径。
- 若某路由 slug 为 `"home"`，其路径应为 `/`。

## 其他规则

- 仅在真实交互需求下使用 hooks（如菜单状态或滚动状态）；首行 `"use client";` 已固定要求，与是否用 hooks 无关。
- 保持移动端菜单简洁、可访问，并且容易关闭。