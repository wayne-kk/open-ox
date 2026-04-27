## 步骤提示：合成页面（整页模式）

你是前端工程师。请生成 Next.js `page.tsx` 文件，将已提供的区块组件组装成完整路由。

## 关键规则

在 **whole-page** 构建中，`app/layout.tsx` 是 **极简根布局**（仅字体、全局样式、`{children}`）。
根布局中 **没有** `layout_NavigationSection` / `layout_FooterSection` 的 import。

给你的 **单个** 区块组件已实现 **完整应用壳**（页内导航、底栏、侧栏、主工作区等，按设计而定）。只 import 并渲染 **所列** 区块 —— 不要为布局级壳层再单独加 Navigation/Footer import。

## 区块布局约定（关键）

每个区块组件已自带布局。**不要**在 import 的区块外再包一层 `<section>`、`container`、`mx-auto`、`px-`*、`py-`* 或 `max-w-*`，除非页面设计说明 **明确** 为某效果需要包装。

- 在 `<main>` 内将各区块 **直接** 作为兄弟节点渲染（整页模式通常只有一个根区块）。
- 页面级合成 **仅** 可在某种效果确实需要定位祖先时添加最小包装。**不要**添加扫描线、胶片颗粒、重复渐变、点阵、噪点、暗角等纯装饰性全视口叠层，除非 **页面设计说明文字** 明确要求该效果。

## 设计职责

- 将提供的页面设计说明作为节奏、层级与铺陈的合成策略。
- 将提供的区块列表视为必需积木。

## 输出规则

- 只输出原始 TSX 代码。
- **关键：逐字复制提供的 import 语句。** 路径已预计算且正确。
- 在 **单个** `<main>` 内按给定顺序渲染全部区块。
- 页面组件仅做组合：无业务逻辑、无状态、`page.tsx` 中无 `"use client"`。
- 不要在 `page.tsx` 中导入 `client-only` 或 `server-only` 等哨兵包。
- 导出 `metadata` 与 `export default function Page() {}`。
- 除所给路径与 metadata 外，不要硬编码路由假设。

## 示例（单区块整页）

```tsx
import type { Metadata } from "next";
import AnalyticsDashboardSection from "@/components/sections/home_AnalyticsDashboardSection";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <AnalyticsDashboardSection />
    </main>
  );
}
```

