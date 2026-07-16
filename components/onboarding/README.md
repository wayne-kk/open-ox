# Product Tour（新人引导组件）

Mainstream product-tour pattern（对齐 Joyride / Shepherd / Driver.js）：

- **Portal 到 `document.body`**，`z-index: 9999`，压过侧栏 / sticky 头
- **经典 box-shadow 挖洞**：整页遮罩始终在页面之上
- **`onStepChange` + `step.panel`**：宿主可在步骤切换时切 Studio 面板（如 Preview）
- **与两步任务解耦**：`tourSeen` / `workspaceTourSeen` 独立于 checklist

## Studio / Workspace

- Studio：`lib/onboarding/studioTourSteps.ts`（欢迎图：`/onboarding/studio-tour-welcome.png`）
- Workspace：`lib/onboarding/workspaceTourSteps.ts`
- 调试：`?ox_onboarding=1`

## Studio 出现时机

首次进 Studio 几乎一定在生成中。导览**不在生成中弹出**；等 `!loading`，且满足「预览已首屏画出」或「项目已有成品」后再出现。`?ox_onboarding=1` 仍可在空闲时强制调试。
