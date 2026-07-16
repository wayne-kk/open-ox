# Product Tour（新人引导组件）

Mainstream product-tour pattern（对齐 Joyride / Shepherd / Driver.js）：

- **Portal 到 `document.body`**，不改宿主业务 DOM 结构
- **遮罩 + spotlight 挖洞**（`[data-ox-tour="<id>"]`），带微光描边
- **分步卡片**：媒体区 / 占位插画、eyebrow、进度点、上一步 / 下一步 / 跳过
- **媒体槽**：`step.media.src` 或 `step.media.node`；未配图时用设计过的占位层

## Studio 默认 6 步

欢迎 → 对话 → Topology/Code/Preview → 预览区 → Design Mode → 收尾（积分说明）

配置：`lib/onboarding/studioTourSteps.ts`  
调试：`/studio/<id>?ox_onboarding=1`

## 加图

```ts
media: { src: "/onboarding/welcome.png", alt: "…" }
```
