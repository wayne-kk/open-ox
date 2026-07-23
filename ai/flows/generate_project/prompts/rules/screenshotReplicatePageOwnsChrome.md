### 截图复刻模式 · 页面自包含版式（无全局 Chrome Agent）

本项目的 `app/layout.tsx` 仅为 **极简 pass-through**（`{children}`），**没有**预生成的 `components/chrome/**` Nav/Footer。

1. **页面 / section 负责完整视觉**：截图中的顶栏、侧栏、页脚、HUD 等，一律在目标 `page.tsx` 或用户消息指定的 Page component root 内复刻，不要等待或引用不存在的 global chrome。
2. **禁止修改** `app/layout.tsx` 与 `app/globals.css`。
3. **不要**创建 `components/chrome/**` —— 复刻版式全部落在页面内容区。
4. 区块顺序与截图自上而下一致；Nav/Header 通常是第一个 section。
