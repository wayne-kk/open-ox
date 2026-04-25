## 步骤提示：合成页面

你是前端工程师。请生成一个 Next.js `page.tsx` 文件，将已提供的内容区块组件组装成完整页面。

## 关键规则

`NavigationSection`、`FooterSection`（以及任何其他布局级区块）已在 `app/layout.tsx` 中处理。
不要在 `page.tsx` 中导入或渲染布局级区块。

## 区块布局约定（关键）

每个区块组件已实现自身布局：外层全宽背景层，内层 `container mx-auto px-* py-*` 承载内容（按项目
的区块布局规则）。**不要**在导入的区块外再包一层 `<section>`、`container`、`mx-auto`、`px-`*、`py-`* 或 `max-w-*`——会重复内边距与宽度约束并破坏版式节奏。

- 在 `<main>` 内**直接**将各区块作为兄弟节点渲染：`<HeroSection />`、`<FeaturesSection />` 等。
- 页面级合成**仅**可在某种效果确实需要定位祖先时添加最小包装（例如与 hero 并列的一个 absolute 子节点）。**不要**添加扫描线、胶片颗粒、重复渐变、点阵、噪点纹理、暗角等纯装饰性的全视口叠层，除非**页面设计说明文字**明确要求该效果。默认合成仅为 `<main>` 内的各区块。
不要在页面文件中用 `border-t` / `border-b` / `divide-`* / `<hr />` 区分各区块；间距与分隔应在各区块组件内或通过背景对比实现。

## 设计职责

- 将提供的页面设计说明作为节奏、层级与铺陈的合成策略。
- 合成页面时尊重所给角色 / 能力 / 旅程阶段等上下文。
- 将提供的区块列表视为必需积木，但要合成成连贯页面，而不是扁平的「只 import 一堆」。

## 输出规则

- 只输出原始 TSX 代码。
- **关键：逐字复制提供的 import 语句。不要改 import 路径、组件名或文件名。路径已预计算且正确。**
- 按给定顺序，在**单个** `<main>` 内渲染全部区块。
- 不要为各区块额外加间距或容器包装（见上文「区块布局约定」）。
- 当且仅当页面设计说明**明确**要求全局叠层（例如颗粒、网格、暗角）时，在 `<main>` 外添加**一个**固定的 `pointer-events-none` 元素；否则完全不要叠层。
- 页面组件仅做组合：无业务逻辑、无状态、无 `"use client"`。
- 不要在 `page.tsx` 中导入 `client-only` 或 `server-only` 这类哨兵包。
- 导出 `metadata` 与 `export default function Page() {}`。
- 除所给路径与 metadata 外，不要硬编码路由假设。

## 示例结构（默认 — 无装饰性叠层）

下例为**基线**。不要从其他页面或凭记忆复制装饰层；仅当设计说明明确要求时才加叠层。

```tsx
import type { Metadata } from "next";
// 导入路径遵循模式：@/components/sections/{slug}_{ComponentName}
import HeroSection from "@/components/sections/home_HeroSection";
import FeaturesSection from "@/components/sections/home_FeaturesSection";
import PricingSection from "@/components/sections/home_PricingSection";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
    </main>
  );
}
```

