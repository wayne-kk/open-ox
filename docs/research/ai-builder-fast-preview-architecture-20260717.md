# 调研：竞品 AI Builder「快速预览」服务架构 vs Open-OX `/site-previews`（2026-07-17）

**状态**：完成（基于第一方公开材料：官方 docs、第一方工程博文、厂商 npm/源码、可观察公开 URL 形态；**未登录**各产品内部编排器，未把二手合集当证据）  
**日期**：2026-07-17  
**问题**：同类 AI builder（Lovable、v0/Vercel、Bolt/WebContainers、Replit Agent、可选 Framer）的「快速预览」架构如何设计？为何已构建项目能做到秒开级预览？Open-OX 当前 `/site-previews` 代理路径问题在对照下有多严重？应学什么、刻意不抄什么？

**范围说明**：

1. 焦点是 **serving / preview runtime**（资源如何送达浏览器），不是 code-gen 管线。
2. 必查：Lovable、v0/Vercel Sandbox、Bolt.new + WebContainers、Replit Preview/Deploy。
3. 可选：Framer（canvas preview ≠ 静态导出代理）、Cursor（非 website builder 预览产品）。
4. Supabase Storage 对 HTML/CSP 的限制作为 Open-OX 代理存在的 **根因** 一并核对。
5. **不把** Medium/第三方「揭秘」文当作架构证据（除非与第一方交叉）。

**Open-OX 对照基线**（本仓库事实）：

| 环节 | 路径 / 行为 |
|------|-------------|
| 后端选择 | `lib/previewMode.ts` → production 典型为 **storage** |
| 同步 | `lib/staticSitePreview.ts`：`next build` → 上传 `out/` → 指纹一致则 instant skip |
| 浏览器加载 | `app/site-previews/[projectId]/[[...path]]/route.ts` 同源代理 |
| 代理原因 | Storage 公网响应含 `CSP: default-src 'none'; sandbox`（见文件头注释）；官方另强制 HTML→`text/plain` |
| 鉴权 | 每请求 `assertStaticPreviewAccess` → `getProject(..., select("*"))` + `getSessionUser` / 可能 `isAdminUser` |
| 缓存 | 统一 `Cache-Control: public, max-age=60, s-maxage=60`；`fetch(Storage, { cache: "no-store" })` |
| 规范 vs 实现 | `docs/preview-public-static-spec.md` 建议 hashed `_next/static/**` 长缓存；代码未实现 |
| 产品文档 | `app/[locale]/docs/preview/page.tsx`、`docs/architecture.md` §6.0 |

用户洞察（待对照验证）：**已构建项目** 的瓶颈应在 serving，而非 rebuild——指纹 skip 已存在；慢在代理热路径。

---

## 1. 结论摘要

| 维度 | 竞品公开模式（能证实的） | Open-OX 当前 | 严重度（对「已构建秒开」） |
|------|--------------------------|--------------|---------------------------|
| **预览跑在哪** | **独立预览 host / 沙箱 VM / 浏览器内 WebContainer**；iframe `src` 指向专用域 | 同源 **`/site-previews/{id}`** Next Route Handler | **高**：所有字节经应用 Node 进程 |
| **资产如何送达** | CDN / 沙箱直出 / 浏览器本地转发；**不**经主站应用层逐文件鉴权 | 每 HTML/JS/CSS/图：鉴权 → Storage 拉 → 回写 | **高**：N 资源 ≈ N 次 DB+上游 |
| **鉴权 / 租户** | 公开站：能力 URL 或公开托管；编辑态沙箱：会话级隔离；**未见**「每个静态 chunk 查全量 project 行」 | 每资产 `select("*")` 全行（含 build_steps / history） | **极高**：鉴权 payload 远大于资产本身 |
| **缓存** | hashed 静态：`immutable` / 长 TTL（Vercel 文档）；HTML 短缓存 | 一律 `max-age=60`；上游 `no-store` | **高**：规范已写对、实现未做 |
| **为何能秒开** | 产物已在边缘 / 沙箱已热 / 浏览器本地 serve；**不再**走构建 | 同步可 instant skip，但 **打开 iframe 仍走重代理** | **根因确认**：rebuild 不是瓶颈 |
| **CSP / 隔离** | 独立 origin（cookie 隔离）或 WebContainer credentialless；主站不转发 Storage CSP | 代理 **省略** Storage CSP 才能跑脚本 | 代理 **必要**（Storage 不能当站点 host）；重鉴权 **不必要** |
| **Studio 热改 vs 社区冷开** | Lovable：云端 Vite + HMR；v0：Sandbox + 发布 CDN；Bolt：WebContainer 本地；Replit：`.replit.dev` 热 URL | Studio/社区共用静态代理路径 | 中：冷开应用静态+CDN；热改另议 |

**一句话**：竞品「秒开」几乎都来自 **「预览资产离开应用源站」**（专用 subdomain / CDN / 沙箱 / 浏览器内运行时）；Open-OX 已正确选择「静态导出 + 指纹 skip」，但把 **每一字节** 拉回 Next 源站并做 **全量 project 行鉴权**，把「已构建」的 serving 变成最贵路径。相对竞品，这是 **架构级偏差**，不是小优化缺口——且与自家 `docs/preview-public-static-spec.md` 已写明的目标冲突。

---

## 2. 分产品深潜（第一方）

### 2.1 Lovable

#### 编辑态预览（Studio iframe）

第一方工程博文（2025-03-13）明确：

- 项目启动时 **云端 ephemeral Vite/Node 开发服务器** 立刻起来。
- 「continuously host over **4,000 instances on fly.io**」。
- 每容器含完整应用代码；多区域集群；Save 后推 diff → **Vite HMR** 刷新预览。

来源：https://lovable.dev/blog/visual-edits

第一方 npm `@lovable.dev/lovite`（Vite 配置包装）进一步写死 sandbox 契约：

- 检测 `LOVABLE_SANDBOX`；强制 port **8080**、host `::`、`strictPort`。
- **移除** 用户自定义 server headers / proxy（「Lovable's proxy manages headers」「Handles WebSocket connections for HMR」）。
- 文档原话：sandbox 在 **proxy 后** 跑 Vite；proxy **按 subdomain 路由**、管理 CORS、HMR WebSocket。

来源：https://www.npmjs.com/package/@lovable.dev/lovite

**推断（与第一方一致、但未公开完整拓扑图）**：编辑态预览 iframe 指向 **专用预览域上的反向代理 → Fly 上的 Vite**，而不是 `lovable.dev` 同源应用层逐文件代理静态桶。资产由 Vite/dev server（及 proxy）服务；HMR 走 WebSocket。冷启动成本在「机器/卷是否已热」；**已热项目** 的打开延迟主要是 iframe 连上已有实例，而非重建静态树。

#### 发布 / 分享站（非编辑态）

- Publish：部署快照到 **`[name].lovable.app`**（或 custom / branded）。
- Branded：`app-name.workspace-subdomain.lovable.app`；文档单独列出 **Preview URLs**：`preview--app-name.workspace-subdomain.lovable.app`。
- Preview toolbar：编辑态 UI 工具，不描述静态 CDN 架构。
- Share：Preview link（短时、免登录看运行中 app）与 Published URL 分轨——见既有调研笔记交叉引用 docs。

来源：

- https://docs.lovable.dev/features/publish （产品：发布到 lovable.app）
- https://docs.lovable.dev/features/branded-workspace-urls （含 `preview--` 形态）
- https://docs.lovable.dev/features/preview-toolbar
- 既有笔记：`docs/research/lovable-community-publish-remix-20260709.md`（Preview link / Website access）

**对「已构建秒开」的含义**：公开/分享看站走 **独立 `*.lovable.app` 托管面**；不是主站应用代理。编辑态靠 **常驻/可唤醒的云端 Vite 池**（贵、但交互秒级）。Open-OX 若只优化社区冷开静态，应学 **发布面 CDN**；若要对齐 Studio HMR，那是另一条（E2B/`local`）产品线，不能用重代理静态冒充。

**未知**：Lovable 是否对已发布静态资源做 immutable 缓存、边缘细节——docs 未写；不宜臆测。

---

### 2.2 v0 / Vercel

#### 聊天内预览

- 每 chat **独立 sandbox**（轻量 VM）；Preview tab = sandbox 内 **dev server** 提供的 URL。
- 「powered by **Vercel Sandbox**」；替代旧 browser-based preview；可跑 SSR / API / DB。
- 生命周期：首次需要时创建；会话最长 24h；idle 停止，再访 resume；文件系统同 chat 持久。
- FAQ：预览「exactly as it would in production」；同时承认「real builds … takes a bit more time than before」。

来源：

- https://v0.app/docs/sandbox
- https://v0.app/docs/faqs （How do previews work now? / Why does v0 feel slower?）

#### Vercel Sandbox 原语（底层）

- Firecracker microVM；「start in **milliseconds**」；隔离文件系统与网络；可跑 live preview。
- 与 production 部署 **不是同一台机器**。

来源：https://vercel.com/docs/sandbox

#### 发布面

- Publish → Vercel Production；「global CDN distribution」。
- 缓存文档：hashed 静态（JS/CSS/fonts）推荐 `Cache-Control: max-age=31536000, immutable`；框架（Next）通常自动设置 `_next/static`。

来源：

- https://v0.app/docs/deployments
- https://vercel.com/docs/caching/cache-control-headers

**对 Open-OX**：v0 的「快」分两层——(A) 热 sandbox resume；(B) 发布后边缘 immutable。Open-OX storage 路径 intentional 接近 (B) 的静态模型，但 **没有** 把 (B) 的 CDN/缓存做对，又没有 (A) 的独立 host。**不应**为了抄 v0 而默认给每个访客起 VM；应对齐的是 **发布态边缘缓存**。

---

### 2.3 Bolt.new / StackBlitz WebContainers

#### 编辑态预览

Bolt README（第一方）：Bolt.new = AI + **StackBlitz WebContainers**——在浏览器内安装 npm、跑 Node 服务器、预览、再部署。

来源：https://github.com/stackblitz/bolt.new （README 主张；本调研拉取 raw 时超时，与先前可检索 README 内容一致）

WebContainers 官方 Quickstart：

1. `WebContainer.boot()`（昂贵；单例）。
2. `mount` 文件 → `spawn` install/dev。
3. `server-ready` 事件给出 **url** → 赋给 iframe。

来源：https://webcontainers.io/guides/quickstart

**可观察公开 URL 形态（推断，标为推断）**：社区/issue 中预览域形如  
`*.local-credentialless.webcontainer.io`（含端口哈希段）。这表明预览在 **独立 origin**，配合 COEP credentialless / iframe 隔离，而不是主站同源代理。  
来源（可观察 + StackBlitz 工程语境，非产品白皮书）：

- https://github.com/stackblitz/webcontainer-core/issues/1555
- https://blog.stackblitz.com/posts/bringing-webcontainers-to-all-browsers/

#### 发布面

- 内置 hosting：`.bolt.host`，「publish … in seconds」。
- 可选 Netlify 等。

来源：https://support.bolt.new/cloud/hosting

**对 Open-OX**：**学**「预览与主站不同 origin」；**刻意不抄**「整站编辑态依赖浏览器内 Node」——Open-OX 已选静态导出以降低常驻成本（`docs/architecture.md` §6.2），与 WebContainer 产品赌注不同。WebContainer 的「秒开」对 **已 mount 的热会话** 极强；对 **冷开社区页** 仍需下载/boot（公开材料未给冷启动 p50）。

---

### 2.4 Replit Agent / Preview

- Preview（原 Webview）：Run 后分配 **临时公网 URL**；Preview 工具渲染该页。
- Development URLs：`UUID.servername.replit.dev`；**仅在积极开发时存活**；可换。
- 默认 **对公网公开**（持 URL 即可看）；可开 private（需认证）。
- 正式分享应用：docs 建议 **Publish/Deployments**，而非依赖开发 URL。
- Agent App Testing：真实浏览器里点点点——仍基于运行中的 app 预览面。

来源：

- https://docs.replit.com/references/editor/preview
- https://docs.replit.com/core-concepts/project-editor/app-setup/development-urls
- https://docs.replit.com/references/agent/app-testing
- https://docs.replit.com/build/troubleshooting （Preview vs published URL）

**对 Open-OX**：同样是 **专用 `*.replit.dev` host**，开发态资产不经编辑器源站。鉴权在「URL 是否 private」层，而不是每个 JS chunk 查库。社区/正式面走 Publish。

---

### 2.5 Framer（简短）

- Preview：编辑器内 Play / `⌘P`，canvas 预览模式；**非**「静态导出 + 对象存储」叙事。
- Publish：`framer.app` 域 + 可选 custom；Staging 与 Production 分轨。

来源：

- https://www.framer.com/help/articles/how-to-preview-your-site/
- https://www.framer.com/help/articles/publishing-your-framer-website/

**相关性低**：与 Open-OX 的 Storage 代理问题不在同一架构族；可忽略为主要对照。

---

### 2.6 Cursor（边界）

Cursor Cloud Agents / IDE 预览属于 **通用编码环境**，不是「生成站 → 社区 iframe 秒开」产品。本调研 **不作为** 快速预览架构对照，除非未来 Open-OX 走「用户本地 IDE」路径。

---

## 3. 横切架构模式

| 模式 | 谁在用（公开材料） | 核心收益 | 典型代价 |
|------|-------------------|----------|----------|
| **A. 云端常驻/可唤醒 Dev Server + 专用 subdomain proxy** | Lovable（fly.io + lovite proxy） | HMR、真实框架 runtime、编辑态秒级反馈 | 机器池成本；需 WebSocket 代理 |
| **B. 云端短寿命 microVM + 框架感知 dev server** | v0 / Vercel Sandbox | 生产一致性（SSR/API）；毫秒级声称冷启 | 仍有 resume/build 成本；FAQ 承认变慢 |
| **C. 浏览器内 WebContainer + 独立 preview origin** | Bolt / StackBlitz | 零用户侧服务器；主站不传字节 | COOP/COEP；冷 boot；能力边界 |
| **D. 容器/VM 临时公网 URL（`.replit.dev`）** | Replit | 真进程 + 易分享；鉴权可选 | URL 不永久；开发态 vs Publish 分轨 |
| **E. 静态产物 → 对象存储/CDN → 浏览器直连** | 各家 **Publish** 面；Vercel CDN 文档；Open-OX **意图** | 已构建近瞬时；可 immutable | HTML 短缓存；需正确 Content-Type/CSP |
| **F. 应用源站反向代理对象存储（每请求鉴权）** | **Open-OX 现状** | 可剥 CSP、可注入 Design Mode bridge、可 ACL | **吞吐与延迟塌方**；与 E 的目标相反 |

**为何竞品能避免 F**：

1. **HTML 站点不放「禁止当网站用」的对象存储直链**（见 §4 Supabase）；或不用 Storage 当 origin。
2. **租户隔离靠独立 origin / 沙箱边界**，不是每个 chunk 查 owner。
3. **公开预览用能力 URL 或公开部署**；私有预览用 cookie 门闸进沙箱入口，静态资源随后 cookie-less 或同沙箱 cookie。
4. **hashed 资源长缓存**（Vercel 文档明文）。

---

## 4. Supabase Storage：Open-OX 代理的根因（第一方）

### 4.1 HTML 强制 `text/plain`

官方 Quickstart：

> For security, **HTML files are returned as plain text**.

来源：https://supabase.com/docs/guides/storage/quickstart

源码 `normalizeContentType`：若 mimetype 含 `text/html` → 返回 `text/plain`。  
来源：https://github.com/supabase/storage/blob/master/src/storage/renderer/renderer.ts

### 4.2 CSP `default-src 'none'; sandbox`

- Open-OX 代码注释与代理实现：**故意不转发** Storage 的 CSP，因含 `sandbox` 且无 `allow-scripts`，iframe 内脚本被拦。  
  来源：`lib/staticSitePreview.ts` 文件头；`app/site-previews/.../route.ts`（注释 *Intentionally omit Storage Content-Security-Policy*）。
- **官方 Storage 用户文档**未用专章描述该 CSP 字符串；**可观察 / 社区实测** 响应头含 `Content-Security-Policy: default-src 'none'; sandbox`（例：supabase/cli#4396 调试日志）。  
  来源：https://github.com/supabase/cli/issues/4396  
  → 标为：**可观察行为 + 本仓库注释**；非 Storage 产品「Hosting sites」文档承诺。

### 4.3 含义

在 Supabase 上「静态站点进 public bucket 直链 iframe」**产品上不可行**（HTML plain + CSP sandbox）。因此：

- **某种** 剥离 CSP / 纠正 Content-Type 的服务层是 **合理且必要** 的；
- **不等于** 必须用「Next.js 全量鉴权 + `select("*")` + `no-store`」实现该服务层。

Storage 文档另称 public bucket 有 **Global CDN**（性能面）。  
来源：https://supabase.com/docs/guides/storage  

**推断**：若 Open-OX 继续用 Storage 存 `out/`，理想路径是 **边缘 Worker / 独立 preview 域** 做薄代理（修 MIME、剥 CSP、可选签名），让浏览器 **直接打 CDN**，应用源站只签发入口，而不是逐字节中转。

---

## 5. Open-OX Gap 对照（映射已测问题）

### 5.1 已做对的部分

| 点 | 证据 |
|----|------|
| 静态导出降低常驻成本 | `docs/architecture.md` §6.2；产品 docs preview 页 |
| 指纹一致 skip rebuild | `lib/staticSitePreview.ts` `tryInstantStaticPreviewReturn` / fingerprint skip |
| 规范写明 HTML 短缓存 / hashed 长缓存 | `docs/preview-public-static-spec.md` §3.1 |
| 公开预览意图（能力 URL） | 同规范 § 访问控制；`canAccessStaticPreview` 在 `publishPreview` 时允许匿名 |
| Design Mode bridge 可在 HTML 注入 | `route.ts` `injectDesignModeBridgeIntoHtml`（需要 HTML 经过可控服务） |

### 5.2 与竞品/规范冲突的热路径

```
浏览器请求 /site-previews/{id}/_next/static/...js
  → assertStaticPreviewAccess
       → getProject(admin, id)  // select("*") 全行
       → getSessionUser()
       → 可能 isAdminUser()
  → fetch(Storage public URL, { cache: "no-store" })
  → 响应 Cache-Control: max-age=60（含 hashed 文件）
```

证据：

- `app/site-previews/[projectId]/[[...path]]/route.ts`：`assertStaticPreviewAccess`、`cache: "no-store"`、`max-age=60`
- `lib/projectManager.ts`：`getProject` → `.select("*")`（对比 `listProjects` 刻意避开重 JSON 列的注释）
- `lib/auth/projectAccess.ts`：`canAccessStaticPreview` 本身只需 `ownerUserId` + `publishPreview`

用户测量（对话给定，本调研视为内部实测输入）：全行约 **~99KB**（含 `build_steps` / `modification_history`）。每页面数十～百级静态请求时，鉴权 DB 流量可超过静态字节本身。

### 5.3 严重度判定

| 问题 | 相对竞品 | 是否阻塞「已构建秒开」 | 修复是否需换栈 |
|------|----------|------------------------|----------------|
| 每资产 `select("*")` | 未见对标 | **是（主因）** | 否：瘦查询 / 缓存 ACL |
| 每资产 session + admin 查 | 公开预览面通常无 | **是** | 否：入口一次鉴权 / 签名 cookie |
| 统一 `max-age=60` + upstream `no-store` | 违背 Vercel/自家规范 | **是（次因）** | 否：按路径分流 Cache-Control；允许边缘缓存 |
| 同源应用 Node 中转全部字节 | 竞品用专用 host/CDN | **是（结构因）** | 中：可先优化代理；中长期独立 preview 域 |
| Storage HTML/CSP 限制 | 根因，竞品不踩这条河 | 迫使有代理层 | 换 CDN/R2/专用桶策略可削弱，但需迁移 |
| Design Mode HTML 注入 | Lovable 用 sandbox 脚本注入（WebContainers `setPreviewScript` 同类能力） | 仅编辑态需要 | 可只对 HTML 走可注入路径，静态 chunk 旁路 |

**结论**：问题 **严重**——不是「再快 20%」级别，而是把本应是 **CDN HIT** 的路径做成了 **应用源站同步瀑布**。用户洞察成立：rebuild/fingerprint 已不是已构建项目的瓶颈；**serving 架构是**。

---

## 6. 对 Open-OX 的建议方向（排序）

### Must-learn（应对齐竞品公开模式）

1. **把鉴权从「每字节」挪到「入口」**  
   - 入口：一次校验 owner / `publishPreview` / 签名。  
   - 后续 `_next/static/**`、图片：cookie-less 或短时 HMAC / CDN signed URL，**禁止**再 `select("*")`。  
   - 即使短期仍走同源代理，也至少改成 `select("user_id, publish_preview")` + 进程内/边缘缓存 ACL（TTL 数十秒即可）。

2. **按资源类型分流 Cache-Control（落实自家规范）**  
   - HTML：`max-age=0, must-revalidate` 或短 TTL。  
   - `_next/static/**`：`public, max-age=31536000, immutable`。  
   - 代理上游：对 immutable 路径允许缓存（去掉一刀切 `no-store`）。  
   - 对照：https://vercel.com/docs/caching/cache-control-headers ；`docs/preview-public-static-spec.md` §3.1。

3. **公开/社区预览：浏览器尽量直连边缘**  
   - 目标形态接近规范 §1「Storage 直连 / 自定义域」——但因 Supabase HTML/CSP，实际应是 **独立 preview 域名上的薄边缘代理**（修 MIME、剥 CSP、长缓存），而不是 Open-OX 主站 Node。  
   - 私有 Studio 预览可保留同源或带 cookie 的 preview 域。

4. **区分「Studio 热预览」与「已构建冷开」**  
   - 冷开/社区：静态 + 边缘（本调研焦点）。  
   - 热改：继续 `local` / E2B / 未来专用 Vite——对齐 Lovable/v0 的是 **这条**，不是把静态代理做胖。

### Optional（有价值，非立刻）

5. **独立 preview subdomain**（如 `p.open-ox…` / 每项目子域）——cookie 隔离、CSP 更干净、可挂 CDN；对标 Lovable `*.lovable.app` / Replit `*.replit.dev`。  
6. **签名 URL / 短 JWT 门闸**——私有项目分享链接，无需每资产 session。  
7. **HTML-only 注入通道**——Design Mode bridge 只污染 HTML；JS/CSS 完全旁路应用逻辑。  
8. **E2B reconnect 快路径**——已有文档化；适合需要 Node runtime 的预览，不替代社区静态。

### 刻意不抄

| 不抄 | 原因 |
|------|------|
| Lovable **4000 Fly Vite 常驻池** 作为社区冷开方案 | 成本模型与 Open-OX「静态导出」决策相反；只适合编辑态 HMR |
| Bolt **纯 WebContainer** 作为唯一预览 | COOP/COEP、冷 boot、与现有 Next 静态导出/社区画廊路径不契合；可作实验轨 |
| v0 **每访客 Sandbox VM** 看社区作品 | 过重；v0 自己也把 Publish 放到 Vercel CDN |
| 「直连 Supabase public URL 当站点」且不代理 | 官方禁止 HTML 渲染；CSP sandbox；与安全设计冲突 |
| 在代理里继续 `select("*")`「图省事」 | 本仓库 `listProjects` 已证明应避开重列 |

---

## 7. 未知与诚实边界

1. Lovable / Bolt / Replit **边缘缓存 TTL、是否对 hashed 文件 immutable**——未在公开 docs 量化。  
2. Lovable `preview--*` 与编辑态 Fly 实例是否同一路由层——仅有 URL 形态 + lovite/proxy 描述，无内部图。  
3. Open-OX 用户侧 **~99KB/行** 为对话给定实测；本调研未在生产复跑。  
4. Supabase CSP 字符串的 **权威文档页** 未找到；以源码 HTML 策略 + 可观察响应头 + 本仓库注释为准。  
5. 未对竞品做登录后 DevTools 抓包（避免账号假设）；URL 形态来自官方 docs 或公共 issue。

---

## 8. Sources appendix

### Open-OX（本仓库）

- `lib/previewMode.ts`
- `lib/staticSitePreview.ts`
- `app/site-previews/[projectId]/[[...path]]/route.ts`
- `lib/projectManager.ts`（`getProject` / `listProjects` select 策略）
- `lib/auth/projectAccess.ts`
- `docs/preview-public-static-spec.md`
- `docs/architecture.md` §6.0–6.2
- `app/[locale]/docs/preview/page.tsx`

### Lovable

- https://lovable.dev/blog/visual-edits
- https://www.npmjs.com/package/@lovable.dev/lovite
- https://docs.lovable.dev/features/publish
- https://docs.lovable.dev/features/branded-workspace-urls
- https://docs.lovable.dev/features/preview-toolbar
- `docs/research/lovable-community-publish-remix-20260709.md`（交叉）

### v0 / Vercel

- https://v0.app/docs/sandbox
- https://v0.app/docs/faqs
- https://v0.app/docs/deployments
- https://vercel.com/docs/sandbox
- https://vercel.com/docs/caching/cache-control-headers

### Bolt / WebContainers / StackBlitz

- https://github.com/stackblitz/bolt.new
- https://webcontainers.io/guides/quickstart
- https://support.bolt.new/cloud/hosting
- https://blog.stackblitz.com/posts/bringing-webcontainers-to-all-browsers/
- https://github.com/stackblitz/webcontainer-core/issues/1555 （**推断** URL 形态）

### Replit

- https://docs.replit.com/references/editor/preview
- https://docs.replit.com/core-concepts/project-editor/app-setup/development-urls
- https://docs.replit.com/references/agent/app-testing
- https://docs.replit.com/build/troubleshooting

### Framer（次要）

- https://www.framer.com/help/articles/how-to-preview-your-site/
- https://www.framer.com/help/articles/publishing-your-framer-website/

### Supabase

- https://supabase.com/docs/guides/storage/quickstart （HTML → plain text）
- https://supabase.com/docs/guides/storage （CDN 声明）
- https://github.com/supabase/storage/blob/master/src/storage/renderer/renderer.ts （`normalizeContentType`）
- https://github.com/supabase/cli/issues/4396 （**可观察** CSP 响应头）

### 修订

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版：竞品快速预览 serving 架构 vs Open-OX `/site-previews` |
