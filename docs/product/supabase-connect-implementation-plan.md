# 技术实现方案：生成站连接 Supabase + 真实种子数据

**状态**：草案（工程可执行）  
**日期**：2026-07-20  
**依据**：[`docs/research/supabase-connect-and-real-data-architecture-20260720.md`](../research/supabase-connect-and-real-data-architecture-20260720.md)  
**对标先例**：[`docs/adr/0003-vercel-byo-deploy.md`](../adr/0003-vercel-byo-deploy.md)（BYO OAuth + 加密 token + Integrations UI）

---

## 0. 决策锁定（MVP）

| # | 决策 | 说明 |
|---|------|------|
| D1 | **MVP = BYO only** | 用户自己的 Supabase org/project；不做 Lovable Cloud 级代管 |
| D2 | **OAuth Integration** | 对齐 Supabase「Build a Supabase Integration」；禁止让用户粘贴 `service_role` 到浏览器 |
| D3 | **复用 Vercel 加密形态** | `encryptSecret` / `decryptSecret`（AES-256-GCM）；可抽共享 `lib/secrets/crypto.ts` 或暂复用并换 key 名 |
| D4 | **审批式 migration + seed** | AI 只提案；用户点批准后服务端执行（对齐 Lovable） |
| D5 | **有后端项目强制动态预览** | `storage` 静态导出无法在构建后访问用户 DB；绑定后端后预览切 `local`（dev）或 `e2b`（prod） |
| D6 | **控制面库隔离** | 业务表不建在 Open-OX 主站 Supabase；只存 connection / plan 元数据 |
| D7 | **Cloud / Claim 延期** | Platforms 代管 + Claim → Phase 2；单独 ADR |

**非目标（MVP）**：Edge Functions 部署、社交登录向导、Realtime、Platform Kit 内嵌 Dashboard、多项目共用一个 Supabase、credits 扣 DB 费。

---

## 1. 目标与成功标准

### 1.1 用户故事

1. 在 Studio / Settings → Integrations **Connect Supabase**（OAuth）。
2. 为当前 Open-OX 项目 **选择或创建** 一个 Supabase project。
3. 系统根据站点意图提案 **Schema + 品牌化种子数据**；用户批准后应用到该 project。
4. 生成/改写的 Next.js 站通过 `NEXT_PUBLIC_SUPABASE_*` 读库；预览列表页显示**真实行**，不是写死 mock。
5. Disconnect 只清 Open-OX 侧 token/绑定，**不删**远程 Supabase 数据（同 ADR-0003）。

### 1.2 验收（MVP Done）

- [ ] OAuth connect / disconnect / token refresh 可用  
- [ ] 项目绑定 `project_ref`；env 写入 `sites/{projectId}/.env.local`（及 Storage 同步策略见下）  
- [ ] SchemaPlan → SQL → 批准 → 远端执行 → 落盘 `supabase/migrations/`  
- [ ] SeedPlan → 批准 → insert → 落盘 `supabase/seed.sql`  
- [ ] Security Advisor 结果在 UI 展示；无 RLS 的表标红  
- [ ] 至少 1 个领域模板（如 restaurant menu / blog posts）端到端预览读库成功  
- [ ] `service_role` / OAuth token **从不**出现在客户端响应或生成站 `NEXT_PUBLIC_*`

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Studio / Settings                                                │
│  Integrations: Connect Supabase                                  │
│  Backend panel: Schema / Seed approve · Advisor · Status         │
└─────────────┬───────────────────────────────┬───────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────────┐
│ Open-OX Control Plane    │    │ Generation / Modify Pipeline     │
│ · user_supabase_conn     │    │ · propose SchemaPlan/SeedPlan    │
│ · project_backends       │    │ · write scaffold + env           │
│ · schema/seed plans      │    │ · page agent 读 lib/supabase/*   │
│ · AES token vault        │    │ · preview → local/e2b if linked  │
└─────────────┬────────────┘    └────────────────┬────────────────┘
              │ service role only                 │
              ▼                                   ▼
┌──────────────────────────┐    ┌─────────────────────────────────┐
│ Supabase Management API  │    │ User's Supabase project          │
│ OAuth · api-keys · SQL   │───►│ Postgres + Auth + (optional)     │
│ advisors/security        │    │ Storage                          │
└──────────────────────────┘    └─────────────────────────────────┘
```

**密钥边界**

| 秘密 | 存储 | 谁读 |
|------|------|------|
| OAuth access/refresh | `user_supabase_connections.*_enc` | 服务端 Management API |
| 用户 project `service_role` / secret | `project_backends.service_key_enc`（可选缓存）或每次 `api-keys?reveal=true` | 仅 apply migration/seed |
| 用户 project anon/publishable | 写入生成站 `.env.local` 的 `NEXT_PUBLIC_*` | 浏览器 / SSR |
| Open-OX 自己的 `SUPABASE_SERVICE_ROLE_KEY` | 主机 env | 控制面；**禁止**写入生成站 |

---

## 3. 数据模型（控制面）

新 migration：`supabase/migrations/035_supabase_backend_byo.sql`（编号以当时最新为准）。

镜像 `029_vercel_deploy.sql` 模式：connection 表 **无** authenticated RLS 写策略（service-role only）；project 绑定表允许 owner SELECT 非敏感字段。

```sql
-- 用户级：Supabase org OAuth（一人可链一个 org；MVP 单连接）
create table if not exists public.user_supabase_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  supabase_org_slug text not null,
  supabase_org_name text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_supabase_connections enable row level security;
-- no policies → anon/authenticated cannot read tokens

-- 项目级：绑定后端
create table if not exists public.project_backends (
  project_id text primary key references public.projects (id) on delete cascade,
  mode text not null default 'byo'
    check (mode in ('byo', 'sandbox')), -- sandbox unused in MVP
  supabase_project_ref text not null,
  supabase_project_name text,
  supabase_url text not null,
  -- optional cache; may refresh from Management API
  publishable_key_enc text,
  service_key_enc text,
  db_pass_enc text, -- only if we created project / user provided for direct SQL
  status text not null default 'linking'
    check (status in ('linking', 'ready', 'error', 'needs_reauth')),
  last_error text,
  last_migration_version text,
  last_seed_at timestamptz,
  advisor_json jsonb,
  preview_backend_override text
    check (preview_backend_override in ('local', 'e2b')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_backends enable row level security;

create policy "project_backends_select_own"
  on public.project_backends for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
-- SELECT 响应在 API 层剥离 *_enc 字段

create table if not exists public.project_schema_plans (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  version int not null,
  domain text,
  plan_json jsonb not null,
  migration_sql text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'applied', 'failed', 'rejected')),
  error text,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table if not exists public.project_seed_plans (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  version int not null,
  plan_json jsonb not null,
  seed_sql text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'applied', 'failed', 'rejected')),
  error text,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

alter table public.project_schema_plans enable row level security;
alter table public.project_seed_plans enable row level security;

-- owner select policies (mirror project_backends)
```

**API 对外 DTO**（永不含 `*_enc`）：

```ts
type ProjectBackendPublic = {
  projectId: string
  mode: "byo"
  supabaseProjectRef: string
  supabaseProjectName: string | null
  supabaseUrl: string
  status: "linking" | "ready" | "error" | "needs_reauth"
  lastMigrationVersion: string | null
  lastSeedAt: string | null
  advisorSummary?: { level: "pass" | "warn" | "fail"; issueCount: number }
  previewBackend: "local" | "e2b"
}
```

---

## 4. 模块与文件地图

### 4.1 新建（建议）

```
lib/supabase-platform/          # 勿与控制面 lib/supabase/* 混淆
  env.ts                        # isSupabasePlatformConfigured, redirect URI
  crypto.ts                     # 或 re-export 共享 secrets crypto + SUPABASE_TOKEN_ENCRYPTION_KEY
  oauth.ts                      # authorize URL, PKCE, token exchange/refresh
  managementApi.ts              # thin fetch wrapper + 401→refresh
  connections.ts                # CRUD user_supabase_connections
  projectBackend.ts             # bind/unbind, public DTO
  applyMigration.ts             # execute SQL + record version
  applySeed.ts
  advisors.ts                   # GET /advisors/security
  schemaPlan.ts                 # types + zod
  seedPlan.ts
  compileSchemaSql.ts           # SchemaPlan → migration SQL (+ RLS templates)
  compileSeedSql.ts             # SeedPlan → ordered INSERTs
  writeSiteEnv.ts               # sites/{id}/.env.local + sync strategy
  scaffold.ts                   # copy template lib/supabase client into generated site

app/api/integrations/supabase/
  start/route.ts
  callback/route.ts
  route.ts                      # GET status / DELETE disconnect
  projects/route.ts             # GET list / POST create+link

app/api/projects/[id]/backend/
  route.ts                      # GET backend public status
  link/route.ts                 # POST { projectRef } | { create: true, name, region, dbPass? }
  schema/propose/route.ts
  schema/apply/route.ts         # body: { planId } after approve
  seed/propose/route.ts
  seed/apply/route.ts
  advisor/route.ts

lib/studio/backend/             # Schema/Seed LLM prompts + structured output
  proposeSchemaFromBrief.ts
  proposeSeedFromSchema.ts
  domainTemplates/              # restaurant.ts, blog.ts, … fallbacks

sites/template/lib/supabase/    # 生成站脚手架源
  client.ts
  server.ts
  middleware.ts                 # optional, auth later

app/[locale]/studio/components/
  SupabaseBackendPanel.tsx      # connect CTA, plan diffs, approve buttons
```

### 4.2 修改（挂钩点）

| 文件 | 改动 |
|------|------|
| `lib/env.ts` | `isSupabasePlatformConfigured()`：`SUPABASE_OAUTH_CLIENT_ID/SECRET` + encryption key |
| `lib/previewMode.ts` / preview 入口 | 若 `project_backends.status=ready` → 强制 `local` 或 `e2b`，忽略纯 `storage` |
| `lib/projectManager.ts` 或导出/同步 | 同步 `.env.local` 时**不要**把 `service_key` 上传到 public 可读位置 |
| `ai/flows/generate_project/runGenerateProject.ts` | 可选 step：`wire_supabase_backend`（仅当已 link）；调用 scaffold + 注入 page brief「优先读库」 |
| `ai/flows/generate_project/prompts/steps/pageImplementAgent.md` | 增加：若存在 `lib/supabase/server.ts` 与 `types/database.ts`，列表数据必须从 Supabase 读 |
| `ai/flows/generate_project/intentAgent/tools.ts`（Phase 1.5） | 可选 `propose_backend_domain`；MVP 可先不做 tool，用 Backend Panel 按钮触发 |
| Settings Integrations UI | 与 Vercel Connect 并列的 Supabase 卡片 |
| `.env.example` | 文档化新 env |

### 4.3 环境变量（主机）

```bash
# Supabase OAuth App (Management API) — 与控制面 NEXT_PUBLIC_SUPABASE_* 不同
SUPABASE_OAUTH_CLIENT_ID=
SUPABASE_OAUTH_CLIENT_SECRET=
SUPABASE_OAUTH_REDIRECT_URI=   # optional; default {SITE}/api/integrations/supabase/callback
SUPABASE_TOKEN_ENCRYPTION_KEY= # min 16 chars; same derivation as Vercel crypto

# Feature gate
OPEN_OX_SUPABASE_BACKEND=1
```

生成站（写入 `sites/{projectId}/.env.local`）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # or publishable when available
# 禁止写入 SERVICE_ROLE
```

---

## 5. OAuth 与 Management API

### 5.1 流程（对齐官方 + 现有 Vercel）

1. `GET /api/integrations/supabase/start?next=/settings/integrations`  
   - 校验登录  
   - 生成 `state` + PKCE `code_verifier`（cookie，同 `vercel_oauth_*`）  
   - Redirect → `https://api.supabase.com/v1/oauth/authorize?...&code_challenge=...`

2. `GET /api/integrations/supabase/callback`  
   - 校验 state / uid  
   - `POST /v1/oauth/token` 换 token  
   - `encryptSecret` 后 upsert `user_supabase_connections`  
   - 清 cookie，redirect `next`

3. Token 使用：`managementApi.ts` 统一带 `Authorization: Bearer`；401 则 refresh，失败标 `needs_reauth`。

参考实现模板：

- `lib/vercel/oauth.ts` / `connections.ts` / `crypto.ts`  
- `app/api/integrations/vercel/start|callback|route.ts`  
- 官方：https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration

### 5.2 Management 调用清单（MVP）

| 操作 | 方法 |
|------|------|
| 列 projects | `GET /v1/projects`（按 org 过滤） |
| 建 project | `POST /v1/projects`（存 `db_pass_enc`） |
| 健康检查 | `GET /v1/projects/{ref}/health` 至 `ACTIVE_HEALTHY` |
| API keys | `GET /v1/projects/{ref}/api-keys?reveal=true` |
| 跑 SQL | `POST /v1/projects/{ref}/database/query`（MVP 主路径） |
| Security advisor | `GET /v1/projects/{ref}/advisors/security` |

**说明**：`POST .../database/migrations` 为 select-customer；MVP 用 `database/query` 执行整份 migration SQL，并在控制面/`supabase/migrations/` 自管版本号。若后续拿到 Platforms migrations API，再换薄封装，不改产品 UX。

**限制（官方）**：已有项目的 DB password **无法**经 Management API 取回；仅「我们代建」或「用户粘贴密码（高级，可延期）」才能直连 Postgres。MVP 优先走 Data API / `database/query`，避免强依赖 db_pass。

---

## 6. Schema / Seed 管线

### 6.1 类型

```ts
// lib/supabase-platform/schemaPlan.ts
export type SchemaPlan = {
  domain: string
  tables: Array<{
    name: string
    columns: Array<{
      name: string
      type: string // postgres type
      pk?: boolean
      nullable?: boolean
      refs?: { table: string; column: string }
    }>
    rls: Array<{
      name: string
      cmd: "select" | "insert" | "update" | "delete"
      roles: Array<"anon" | "authenticated">
      usingSql: string
      withCheckSql?: string
    }>
  }>
  storageBuckets?: Array<{ name: string; public: boolean }>
}
```

```ts
export type SeedPlan = {
  tables: Array<{
    name: string
    rows: Record<string, unknown>[]
  }>
}
```

LLM 输出必须经 Zod 校验；失败则重试 1 次或回退 `domainTemplates/{domain}.ts`。

### 6.2 SQL 编译硬约束（`compileSchemaSql`）

对每张 `public` 表生成：

1. `CREATE TABLE` + PK/FK/index  
2. `GRANT` 给 `anon` / `authenticated` / `service_role`（按最小权限）  
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`  
4. `CREATE POLICY ...`（公开目录类：`anon` SELECT；用户私有：`auth.uid()`）  
5. 文件名：`supabase/migrations/{yyyyMMddHHmmss}_{slug}.sql` 写入 **生成站目录**

### 6.3 Seed 编译（`compileSeedSql`）

1. 按 FK 拓扑排序表  
2. 固定 UUID（可选）保证可重跑  
3. 仅 `INSERT`；可选开头 `TRUNCATE ... CASCADE`（仅 DEV/空库，UI 明示）  
4. 文案：注入 brand / locale / design-system 语气；禁 lorem、禁真实 PII  
5. 规模默认每表 8–20 行  

### 6.4 Propose / Apply API

```
POST /api/projects/:id/backend/schema/propose
  → LLM(brief, outline, domain) → SchemaPlan + migration_sql
  → insert project_schema_plans status=proposed
  → return { planId, migrationSql, plan }

POST /api/projects/:id/backend/schema/apply
  body: { planId }
  → verify owner + connection
  → mark approved
  → managementApi database/query(migration_sql)
  → write file to sites/{id}/supabase/migrations/...
  → generate types (optional: openapi or hand-rolled from SchemaPlan)
  → advisor → store advisor_json
  → status=applied | failed
```

Seed 同构。Apply 必须幂等策略明确：同 version 重复 apply → 409 或 no-op。

### 6.5 LLM 调用位置

- `lib/studio/backend/proposeSchemaFromBrief.ts`：使用现有 `shared/llm` / model config（与 plan_project 同级超时策略）。  
- 输入：`user_prompt` / intent brief、site outline（若有）、design-system 品牌名。  
- 输出：严格 JSON（tool/json mode）。  
- **不要**在 page implement agent 里直接 `execute_sql`。

---

## 7. 生成站脚手架与 Agent 契约

### 7.1 `scaffold.ts` 写入生成仓

```
sites/{projectId}/
  .env.local                         # URL + anon only
  lib/supabase/client.ts             # createBrowserClient
  lib/supabase/server.ts             # createServerClient (@supabase/ssr)
  types/database.ts                  # 从 SchemaPlan 生成的窄类型
  supabase/migrations/*.sql
  supabase/seed.sql
  supabase/config.toml               # 最小 stub（可选）
```

模板源：`sites/template/lib/supabase/*`（随 template 维护）。

### 7.2 Page Implement Agent

在 `pageImplementAgent.md` 增加一节（有后端时注入 bootstrap）：

- 若 `types/database.ts` 存在：产品列表/文章列表等**必须** `createClient` 服务端 fetch，禁止大型 mock 数组。  
- 公开内容用 anon；勿引入 service role。  
- 失败时展示空态，不伪造行。

Bootstrap（`pageAgentBootstrap`）附加：`database.ts` 摘要 + 示例查询 snippet。

### 7.3 流水线步骤（可选独立 step）

```
… plan_project → design_system → …
  → [if backend linked] wire_supabase_backend
       scaffold + ensure env + optional auto-propose schema (不 auto-apply)
  → page implement …
```

MVP 也可：**生成完成后再**在 Backend Panel 点「提案 Schema → 批准 → 重跑预览」；第二期再嵌入自动 propose。

---

## 8. 预览 Runtime（关键）

| 后端状态 | 允许 preview |
|----------|----------------|
| 未 link | 现有：`storage` / `local` / `e2b` |
| `project_backends.status=ready` | **禁止**依赖纯静态 `storage` 作为「数据预览」；强制 `local` 或 `e2b` |

实现要点：

1. `getPreviewBackendForProject(projectId)`：查 `preview_backend_override` 或默认 `e2b`（prod）/`local`（dev）。  
2. Studio 提示：「已连接数据库，预览将使用动态运行时」。  
3. Vercel Deploy（ADR-0003）静态导出：**上线静态站仍无 SSR DB**——MVP 文档写明「带 Supabase 的站 Deploy 需后续支持 Node runtime / 非纯 static」；或 Deploy 前检测 `project_backends` 并阻断 + 文案。  

---

## 9. Studio / Settings UX

### 9.1 Settings → Integrations

与 Vercel 卡片并列：

- 未连接：Connect Supabase  
- 已连接：org 名、Reconnect、Disconnect  
- 不展示 token  

### 9.2 Studio → Backend Panel（`SupabaseBackendPanel`）

1. Link project（下拉已有 / Create new）  
2. Domain 选择或「从站点意图推断」  
3. Schema diff（SQL `<pre>` + 表列表）→ Approve & Apply  
4. Seed 预览（表格前 5 行）→ Approve & Seed  
5. Advisor 结果列表  
6. 「在 Supabase Dashboard 打开」深链  

### 9.3 权限

- 仅 `project.user_id === session.user.id`（或现有 `projectAccess` 规则）可 link/apply。  
- 所有 mutate 走 service-role 写库 + 会话鉴权（同 Vercel deploy routes）。

---

## 10. 安全清单

1. API 响应 strip `*_enc`；日志 redact keys。  
2. Apply SQL：仅允许服务端；可选 SQL 静态分析禁 `DROP DATABASE` 等（allowlist：`CREATE/ALTER/GRANT/CREATE POLICY/INSERT/TRUNCATE` 业务表）。  
3. RLS：编译器强制 ENABLE；Advisor fail → UI 阻断「标记为生产就绪」（MVP 可警告不阻断预览）。  
4. Rate limit：propose/apply 每项目每分钟 N 次。  
5. CSRF：OAuth state；cookie `SameSite=Lax`。  
6. 生成站 `.env.local` 不进社区 remix 公开包（检查 export/publish 路径是否排除）。

---

## 11. 测试计划

| 层 | 内容 |
|----|------|
| Unit | `compileSchemaSql` RLS/GRANT；`compileSeedSql` FK 顺序；crypto roundtrip；zod SchemaPlan |
| Unit | OAuth URL / PKCE（仿 `lib/vercel/oauth.test.ts`） |
| Integration | Management API mock：apply migration + seed |
| E2E（手动） | Connect → link → propose → apply → local preview 见数据 |
| 回归 | 未连接项目仍走 storage preview；Vercel deploy 不受影响 |

---

## 12. 分期与估时（粗算）

| Phase | 内容 | 粗估 |
|-------|------|------|
| **P0** | OAuth + connections + link project + env 写入 + Integrations UI | 3–5 人日 |
| **P1** | SchemaPlan/SeedPlan + compile + propose/apply API + Backend Panel | 5–8 人日 |
| **P2** | 生成站 scaffold + page agent 契约 + preview 强制动态 + 1 个领域模板 E2E | 3–5 人日 |
| **P3** | Advisor、类型生成、export 排除密钥、文档/changelog | 2–3 人日 |
| **P4（延期）** | Platforms sandbox、Claim、Cloud UI、Edge Functions、嵌入流水线自动 propose | 另立项（≫ MVP） |

合计 MVP（P0–P3）：约 **2–3 周** 一名熟悉本仓的全栈（含联调），不含 Platforms 商务申请。

---

## 13. 建议实施顺序（PR 切片）

1. **PR1**：migration 表 + `lib/supabase-platform/{crypto,env,oauth,connections}` + start/callback + Settings Connect（无项目绑定）。  
2. **PR2**：list/create/link project + `project_backends` + `writeSiteEnv` + Backend 状态 API。  
3. **PR3**：domain template（手写 Schema/Seed，无 LLM）→ apply → 手动验证读库。  
4. **PR4**：LLM propose + 审批 UI + Advisor。  
5. **PR5**：scaffold + page agent prompt + preview override + restaurant/blog E2E。  
6. **PR6**：ADR-0008 文档化 BYO Supabase 决策（镜像 ADR-0003）。

---

## 14. 与调研文档的差异（实现期默认）

| 调研建议 | 本方案 MVP |
|----------|------------|
| Hybrid sandbox 默认 | **先 BYO**；sandbox = Phase 2 |
| Platforms `database/migrations` | 用 `database/query` + 自管版本 |
| Intent tool 一等公民 | Panel 按钮优先；tool 后置 |
| Claim / Platform Kit | 不做 |

---

## 15. 开放问题（实现前需产品点头）

1. Deploy（静态 Vercel）与带 DB 的站：阻断 vs 仅警告？  
2. Create Supabase project 时 region / 实例默认？  
3. Seed「清空重种」是否默认提供危险按钮？  
4. 加密 key：新建 `SUPABASE_TOKEN_ENCRYPTION_KEY` 还是复用 `VERCEL_TOKEN_ENCRYPTION_KEY`？（建议**分开**）

---

## 16. 参考

- 调研：`docs/research/supabase-connect-and-real-data-architecture-20260720.md`  
- Vercel BYO：`docs/adr/0003-vercel-byo-deploy.md`、`lib/vercel/*`、`app/api/integrations/vercel/*`  
- Supabase OAuth：https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration  
- Supabase Platforms（Phase 2）：https://supabase.com/docs/guides/integrations/supabase-for-platforms  
- RLS：https://supabase.com/docs/guides/database/postgres/row-level-security  
- Seed：https://supabase.com/docs/guides/local-development/seeding-your-database  
