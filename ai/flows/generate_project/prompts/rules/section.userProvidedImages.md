## 用户提供的图片 URL（最高优先级 — 覆盖 `section.default` 中的生图规则）

当 `content/user-provided.md` 存在，或用户消息 / 项目上下文中已列出 **https 图片 URL** 时：

### 必须

1. 将列出的每个 URL 作为 **远程** `src` 写入 TSX（`<img src="…">` 或 `next/image` 的 `src`），**每张 URL 最多使用一次**。
2. **先**在组件代码中嵌入这些 URL，**再**考虑是否需要额外配图。
3. 忽略 `error` / `fetch failed` 等服务端下载标记 — 浏览器可直接加载 `lh3.googleusercontent.com`（已在 `next.config` 的 `remotePatterns` 中）。

### 禁止

- **禁止**用 `generate_image` 生成照片来**顶替、复制或替代**用户提供的任一 URL。
- **禁止**在未使用用户 URL 的情况下，为 Hero / Gallery / Menu 等区块调用 `generate_image` 充当「主画面」。
- **禁止**将同一张用户 URL 重复用于多个组件。

### 何时允许 `generate_image`

仅当 **全部** 用户 URL 已在 TSX 中各使用一次，且版面仍需要**额外**装饰图时，才可调用 `generate_image`（保存到 `public/images/`）。

### 实现提示

- 优先使用用户消息中已内联的 URL 列表（无需等待 `read_file`）。
- 仍可读 `content/user-provided.md` 核对文案与 caption。
