---
inclusion: manual
---

# figma-use — Figma Plugin API Skill

在每次调用 `use_figma` 工具之前必须加载此 skill。不要直接调用 use_figma 而不先加载此 skill。

用于用户需要在 Figma 文件中执行写操作或需要 JavaScript 的读操作时（创建/编辑/删除节点、变量或 token、组件和变体、auto-layout 或填充、变量绑定、程序化文件结构检查）。

如果任务涉及构建或更新完整页面/屏幕/多区域布局，同时加载 `figma-generate-design` skill。

## 详细参考文档

完整的 API 规则和参考文档位于:
#[[file:.cursor/skills/figma-use/SKILL.md]]

参考文档目录:
#[[file:.cursor/skills/figma-use/references/]]

## 关键规则摘要

1. 用 `return` 返回数据，不要用 `figma.closePlugin()` 或 `console.log()`
2. 写纯 JavaScript，支持顶层 `await`，不要包裹 async IIFE
3. `figma.notify()` 会抛错，禁止使用
4. 颜色使用 0-1 范围（不是 0-255）
5. Fills/strokes 是只读数组，需要克隆、修改、重新赋值
6. 文本操作前必须 `await figma.loadFontAsync()`
7. 页面切换用 `await figma.setCurrentPageAsync(page)`
8. `layoutSizingHorizontal/Vertical = 'FILL'` 必须在 `appendChild` 之后设置
9. 增量工作，每步验证，小步快跑
10. 必须 `return` 所有创建/修改的节点 ID
11. 每个 Promise 都要 `await`
