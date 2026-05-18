# 公网静态预览规范（公开访问 · 固定前缀）

本文档固定三类产品决策，供实现 Storage + CDN 预览时对照。

| 决策项 | 结论 |
|--------|------|
| 访问控制 | **公开**：任何知道 URL 的人可看（能力 URL / security through obscurity + `projectId` 足够长且不可枚举） |
| 用户可见 URL 形态 | **固定前缀**：同一项目始终同一逻辑地址，更新预览时覆盖（或短缓存）同源路径 |
| 子路径下的资源解析 | **按 Next 主流方式**：使用 **`basePath`** 与公开路径前缀一致；**不使用**单独折腾 `assetPrefix`（除非静态域名与 HTML 域名分离，本期不设） |

---

## 1. URL 与外显形态

### 1.1 推荐格式（固定前缀）

```
https://{PREVIEW_HOST}/p/{projectId}/
```

- **`PREVIEW_HOST`**：专用预览域名，例如 `preview.example.com`（与主站分开便于 CDN 与安全策略）。
- **`p`**：短固定段，表示 preview（避免与主站路由冲突）。
- **`projectId`**：与仓库内一致（如 `1743750000000_saas-landing-page`），即 **URL 中稳定标识**；不对外再嵌一层随机 token（公开场景下无意义）。

### 1.2 与对象存储 key 的对应关系（逻辑上一致）

对象存储内的 key 前缀与 URL 路径 **1:1**，例如：

```text
s3://bucket/p/{projectId}/index.html
s3://bucket/p/{projectId}/_next/static/...
```

CDN 默认把 `https://PREVIEW_HOST/p/{projectId}/…` 映射到上述对象即可（具体依赖云厂商：自定义域绑定 bucket、或 Worker 反代）。

### 1.3 尾部斜杠

主流做法是 **统一带尾部斜杠** 打开站点根：`/p/{projectId}/`。  

在 CDN / 存储配置中保证：

- 访问 `/p/{projectId}` 时 **301/302** 到 `/p/{projectId}/`，或  
- 直接 resolve 到 `…/index.html`（各云「静态网站托管」配置略有差异，选一种全站一致）。

---

## 2. `basePath` 决策（第三点：主流方式）

静态导出挂在子路径下时，浏览器请求的 HTML 与 `_next` 资源必须同属该子路径。Next.js **官方推荐**在应用级使用 **`basePath`**（文档：Deploying / Static Exports / `basePath`）。

### 2.1 取值

对**上传到预览 CDN 的那次构建**，设置：

```text
basePath = /p/{projectId}
```

注意：**无前导主机名**，且 **无尾部斜杠**（与 Next 文档一致）。

### 2.2 与本地开发 / ZIP 导出的关系

- **本地 `next dev`、用户下载后部署到根路径 `/`**：应保持 **`basePath` 为空**（当前默认）。
- **仅「发布到公网预览」**：在 Open-OX 侧执行一次 **带 `basePath` 的 `next build`**，用产出覆盖 `out/`，再上传 Storage。

即：**双目标构建**是主流折中——不在用户自部署包上强加预览子路径；预览流水线单独带环境变量构建。

建议在模板 `next.config.ts` 中增加（实现阶段落地）：

```ts
basePath: process.env.OPEN_OX_STATIC_BASE_PATH?.trim() || undefined,
```

预览同步任务里在 build 前设置：

```bash
OPEN_OX_STATIC_BASE_PATH=/p/${projectId}
```

然后 `pnpm build`，再上传生成的 `out/`。

### 2.3 不采用 `assetPrefix` 的原因（本期）

`assetPrefix` 适用于「HTML 与静态资源不同源」。当前方案 **HTML 与 `_next` 同前缀、同 CDN**，仅用 `basePath` 即可，配置更简单、与 Next 文档一致。

---

## 3. 「固定前缀」与缓存（覆盖更新）

用户要求 **链接固定**（同一 `https://…/p/{projectId}/`），因此 **不能**依赖「每次新版本换新 URL」来做缓存 bust。

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
2. **流程**（简述）：`out` 无或指纹变化 →（必要时）`OPEN_OX_STATIC_BASE_PATH=/p/{id} pnpm build` → 上传 `out/*` 到 `p/{id}/` → 更新 DB 中 `preview_url`、`preview_synced_at`。  
3. **返回**：始终返回同一 `https://{PREVIEW_HOST}/p/{projectId}/`（或可带尾部斜杠 normalization）。

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
