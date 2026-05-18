# 公网静态预览规范（公开访问 · 固定前缀）

本文档固定三类产品决策，供实现 Storage + CDN 预览时对照。

| 决策项 | 结论 |
|--------|------|
| 访问控制 | **公开**：任何知道 URL 的人可看（能力 URL / security through obscurity + `projectId` 足够长且不可枚举） |
| 用户可见 URL 形态 | **固定对象**：`p/{projectId}/index.html` 的公开 URL（`getPublicUrl`，与 Storage key 一致） |
| 子路径下的资源解析 | 预览构建使用 **绝对 URL `assetPrefix`** 指向 `.../public/site-previews/p/{projectId}`；**不用 `basePath`**，避免 `_next` 解析到错误 host 路径。 |

---

## 1. URL 与外显形态

### 1.1 推荐格式（Supabase 公共对象 URL）

实现返回的是 **`index.html` 的完整 `getPublicUrl`**，例如：

```text
https://{project_ref}.supabase.co/storage/v1/object/public/site-previews/p/{projectId}/index.html
```

Storage **没有**「目录自动回退 index」：不得只打开 `.../p/{id}/` 指望 200，否则会 `Object not found`。

### 1.2 与对象存储 key 的对应关系（逻辑上一致）

对象存储内的 key 前缀与 URL 路径 **1:1**，例如：

```text
s3://bucket/p/{projectId}/index.html
s3://bucket/p/{projectId}/_next/static/...
```

CDN 默认把 `https://PREVIEW_HOST/p/{projectId}/…` 映射到上述对象即可（具体依赖云厂商：自定义域绑定 bucket、或 Worker 反代）。

### 1.3 预览入口

入口即 **`…/index.html` 的 public URL**（或自定义域反代到该对象）；无需依赖「仅尾部斜杠」的目录索引。

---

## 2. `assetPrefix`（实施方式；不用 `basePath`）

静态导出若仅用 `basePath: /p/{id}`，HTML 内脚本常为根路径 `/p/{id}/_next/...`，浏览器会请求 `https://{project_ref}.supabase.co/p/{id}/_next/...`，**落在 Storage `/object/public/...` 之外**，返回 404。正确做法是预览专用构建使用 **绝对 URL 形式的 `assetPrefix`**，与对象前缀一致：

```text
assetPrefix = https://{project_ref}.supabase.co/storage/v1/object/public/site-previews/p/{projectId}
```

- **无尾部斜杠**；与 Next 文档中「静态资源托管到 CDN / 子路径」的用法一致。
- **`out/` 结构**：扁平 `out/index.html`、`out/_next/...`；上传时 key 为 `p/{projectId}/index.html`、`p/{projectId}/_next/...`。
- **本地 dev / ZIP**：不设 `OPEN_OX_STATIC_ASSET_PREFIX`，与普通根路径导出一致。

模板见 `sites/template/next.config.ts`；同步逻辑见 `lib/staticSitePreview.ts`。

---

## 3. 「固定前缀」与缓存（覆盖更新）

同一 `projectId` 下对象 key 固定为 `p/{projectId}/index.html`（覆盖上传），因此 **不能**依赖「每次新版本换新 URL」来做缓存 bust。

### 3.1 推荐缓存策略

| 资源类型 | Cache-Control 建议 | 说明 |
|----------|-------------------|------|
| `**/*.html` | `max-age=0, must-revalidate` 或短 `max-age=60` | 固定 URL 下尽快拿到新壳 |
| `_next/static/**`（带 content hash） | `public, max-age=31536000, immutable` | Next 默认 hash 文件名，可长期缓存 |

上传新版本时：**覆盖**同 key 的文件即可；HTML 短缓存保证用户刷新后较快生效。

### 3.2 可选增强

- 同步完成后对 CDN 执行 **仅针对** `/p/{projectId}/**` 的 **purge**（若厂商 API 支持），减少边缘残留。  
- 非必须：多数场景依赖 HTML 不长期缓存即可。

---

## 4. 预览 API 职责（与实现对齐）

1. **鉴权**：仅 **Studio 已登录用户**可触发「同步/重建预览」；**查看**预览 URL **无需**登录（公开）。  
2. **流程**（简述）：指纹变化 → 带 `OPEN_OX_STATIC_ASSET_PREFIX=<...>/site-previews/p/{id}` 执行 `pnpm build` → 上传扁平 `out/*` 到 `p/{id}/*` → DB `static_preview_synced_at`。预览 URL = `getPublicUrl('p/{id}/index.html')`。  
3. **返回**：始终返回同一 **`getPublicUrl('p/{projectId}/index.html')`**（完整 URL，含与 SDK 一致的编码）。

---

## 5. 安全与滥用（公开场景）

- **projectId** 中含时间戳与 slug，**不要**使用可枚举的短 id。  
- **robots**：可在「预览构建」时在 layout 注入 `noindex`（可选，防搜索引擎收录半成品）。  
- **配额**：对「触发同步」做频率与用量限制，避免刷存储与 CDN。

---

## 6. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-18 | 初版：公开 + 固定前缀 `/p/{projectId}/` + `basePath` 双构建设定 |
| 2026-05-18 | 实现对照：`OPEN_OX_PREVIEW_BACKEND=storage`，代码 `lib/staticSitePreview.ts` + `lib/devServerManager.ts` 分支；DB/桶 `supabase/migrations/020_site_previews_bucket.sql` |
