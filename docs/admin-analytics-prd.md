# Open-OX 后台管理系统 · 产品需求文档（PRD）

**版本**：v0.1 草案  
**日期**：2026-06-15  
**状态**：待评审  
**关联现状**：`/admin`（用户角色）、`/admin/prompts`（Prompt 管理）

---

## 1. 背景与目标

### 1.1 背景

Open-OX 是面向网站生产的 AI Harness 平台。运营团队需要回答：

- 用户从哪里来、是否激活、是否成功生成站点？
- 用户在 Studio 里停留多久、在哪一步流失？
- 生成/修改成功率、成本、模型表现如何？
- 哪些功能被高频使用、哪些几乎没人用？

当前后台仅有**管理员账号管理**，缺少指标看板与行为分析能力。

### 1.2 产品目标

| 目标 | 说明 |
|------|------|
| **可观测** | 核心漏斗与趋势一屏可见，支持按日/周/月对比 |
| **可诊断** | 从汇总指标下钻到用户/项目/单次生成 Run |
| **可决策** | 支撑产品迭代、容量规划、成本管控 |
| **可合规** | 权限隔离、敏感数据脱敏、审计可追溯 |

### 1.3 非目标（v1 不做）

- 面向终端用户的 BI 自助分析
- 实时秒级大屏（v1 以 T+0 ~ T+1 聚合为主）
- 完整 CDP / 用户画像引擎
- 与第三方广告归因深度打通

---

## 2. 用户角色与权限

| 角色 | 权限范围 |
|------|----------|
| **Super Admin** | 全部模块 + 导出 + 成本明细 + 原始日志 |
| **Ops Admin** | 用户/项目/漏斗/留存，不可看 Token 成本明细 |
| **Support** | 单用户/单项目查询、会话回放摘要，只读 |
| **Read-only Analyst** | 聚合看板只读，不可导出 PII |

**鉴权**：沿用现有 `user_roles.admin` + 扩展 `analytics_viewer` / `support` 等角色（建议）。

**审计**：所有导出、单用户详情查看、角色变更写入 `admin_audit_logs`。

---

## 3. 信息架构（IA）

```
/admin
├── /dashboard          # 总览（默认首页）
├── /users              # 用户列表 + 单用户详情
├── /projects           # 项目列表 + 单项目详情
├── /analytics
│   ├── /acquisition    # 获客与注册
│   ├── /activation     # 激活漏斗
│   ├── /engagement     # 停留与活跃
│   ├── /retention      # 留存
│   ├── /generation     # 生成/修改质量
│   └── /cost           # 成本（内部）
├── /system
│   ├── /queue          # 生成队列健康
│   └── /errors         # 错误与告警
├── /prompts            # 已有
└── /settings           # 角色、导出策略、告警阈值
```

---

## 4. 指标定义（Metrics Dictionary）

> 所有指标需明确：**口径、数据源、更新频率、是否含 bot/内部账号**。  
> 实现锚点：`lib/admin/analytics/metricsDictionary.ts`（v1 总览 + 队列）。

### 4.0 v1 已落地口径（2026-07）

| 指标 | 口径 | 内部账号 |
|------|------|----------|
| **DAU** | 已登录用户，当日 UTC 至少 1 次 `page_view` 或 `studio_heartbeat`。建项目 / 建 run **不计**。匿名 PV 不计。 | 分析默认排除 |
| **新增注册** | Auth `created_at` 按 UTC 日聚合；census 翻完 Auth 分页（无静默 4000 顶） | 分析默认排除 |
| **新增项目** | `projects.created_at` 按 UTC 日 | 分析默认排除 |
| **首项目** | 每用户 lifetime 最早一次 `projects.created_at` 落在当日才 +1。API/图表字段：`firstProject`（不再使用误标的 `firstPrompt`） | 分析默认排除 |
| **首 Prompt** | 等埋点 `prompt_submit` 后再上；**当前不做** | — |
| **首次 Ready 用户** | 每用户 lifetime 最早 `status=ready` 的 `completed_at`（缺省则 `created_at`）日 | 分析默认排除 |
| **生成成功率** | 终态 only：`succeeded / (succeeded + failed)`，按 `finished_at` 归 UTC 日；`queued`/`running` 不进分母 | 分析默认排除 |
| **平均生成耗时** | `finished_at - started_at`（分钟），按完成日；P50 为样本中位 | 分析默认排除 |
| **队列 queued / running** | 当前状态 exact count | **不排除**（系统负载） |
| **队列 succeeded24h / failed24h** | `status` + `finished_at >= now-24h` 的 **exact count**（不得从「最近 N 条」推导） | **不排除** |
| **队列平均等待** | 近 30 条样本均值（近似，非全量） | **不排除** |

成本 / 留存 / 停留 / Modify 分布口径见下文，属 **v1.1**（尚未与代码字典对齐）。

### 4.1 用户规模类

| 指标 | 定义 | 数据源（现状/需建设） |
|------|------|------------------------|
| **注册用户总数** | `auth.users` 累计 | ✅ Supabase Auth |
| **新增注册（DAU 注册）** | 按 `created_at` 日聚合 | ✅ |
| **DAU** | 见 §4.0：`page_view` ∪ `studio_heartbeat`（已登录） | ✅ analytics_events |
| **WAU / MAU** | 7日/30日至少 1 次有效行为（同 DAU 事件集） | ⚠️ 未实现 |
| **活跃 Studio 用户** | 进入 `/studio` 或触发 API 的用户 | ⚠️ 需埋点 |
| **内部账号过滤** | admin 角色 / `analytics_internal_accounts` / 邮箱域名；分析 KPI 默认排除，队列不排除 | ✅ |

### 4.2 激活与漏斗类

对齐 `docs/product-iteration-outline.md` 第 9 节：

| 阶段 | 事件 | 转化率示例 |
|------|------|------------|
| 访问首页 | `page_view: /` | — |
| 开始登录 | `auth_start`（Google/Feishu） | 注册/登录率 |
| 完成登录 | `auth_success` | — |
| 首项目（v1 代理） | lifetime 首次 `projects.created_at` | 注册→首项目 |
| 首次输入 Prompt | `prompt_submit`（待埋点） | 注册→首 Prompt |
| 进入 Intent 对话 | `intent_agent_start` | — |
| 开始生成 | `generation_run_queued` | 首项目→开跑 |
| 首次 Ready | `project_status: ready`（用户首个） | **核心激活率** |
| 首次修改 | `modify_run_start` | 深度激活 |
| 预览/导出 | `preview_open` / `export` | 交付率 |

**首活转化（North Star 候选）**  
`注册后 24h 内首个 project.status = ready 的用户占比`

### 4.3 用户停留与行为类

| 指标 | 定义 | 采集方式 |
|------|------|----------|
| **会话时长（Session Duration）** | 单次访问从进入到离开/30min 无操作 | 前端 heartbeat + `visibilitychange` |
| **Studio 停留时长** | 在 `/studio` 及子路由的累计时长 | 路由级 timer |
| **页面 PV / UV** | 各路由独立统计 | `page_view` 事件 |
| **平均页面停留** | 单页 `(next_page - enter)` 或 heartbeat 累加 | 同上 |
| **Intent 阶段停留** | Intent 面板可见时长 | 组件 mount/unmount |
| **生成等待时长** | `queued → running → succeeded` | ✅ `generation_runs` |
| **修改轮次停留** | 每次 modify 对话时长 | ⚠️ 需 modify 事件 |
| **跳出率** | 仅 1 个 page_view 即离开的会话占比 | 会话聚合 |
| **深度会话占比** | 停留 > 10min 且 ≥1 次 modify | 会话聚合 |

**建议 Session 切分规则**

- 新 Session：`last_event + 30min` 无活动，或跨自然日（可配置）
- 排除：爬虫 UA、未登录仅浏览首页（单独统计）

### 4.4 项目与生成质量类

| 指标 | 定义 | 数据源 |
|------|------|--------|
| **项目总数 / 新增** | `projects.created_at` | ✅ |
| **按状态分布** | generating / awaiting_input / ready / failed | ✅ |
| **生成成功率** | `succeeded / (succeeded + failed)`，按 `finished_at` 归日；不含 queued/running | ✅ `generation_runs` |
| **平均生成耗时** | `finished_at - started_at` 或 `projects.total_duration` | ✅ 部分 |
| **Build 修复轮数** | repair 步骤次数 | ✅ `generation_events` / build_steps |
| **Modify 次数/项目** | `modification_history` 长度 | ✅ |
| **验证通过率** | `verification_status = passed` | ✅ |
| **预览同步成功率** | static_preview 相关字段 | ✅ |

### 4.5 留存类

| 指标 | 定义 |
|------|------|
| **D1 / D7 / D30 留存** | 注册日 cohort，第 N 日是否活跃 |
| **项目回访率** | 创建项目后 7 日内再次打开同一 project |
| **「Ready 后回访」** | ready 后 7 日内再次 modify 的比例 |

### 4.6 成本类（内部）

| 指标 | 数据源 |
|------|--------|
| Token 用量（in/out） | Langfuse generations |
| 单次生成成本（估算） | Langfuse + 模型单价表 |
| 每成功站点成本 | cost / ready projects |
| Sandbox 使用时长 | E2B / `sandbox_id` 关联（若有） |

---

## 5. 页面与图表设计

### 5.1 总览 Dashboard（`/admin/dashboard`）

**顶部 KPI 卡片（今日 vs 昨日 / 7日均值）**

- 新增注册
- DAU
- 新增项目
- 首次 Ready 用户数
- 生成成功率
- 平均 Studio 停留（分钟）

**折线图区（默认近 30 天，可切换 7/30/90 天）**

| 图表 | Y 轴 | 说明 |
|------|------|------|
| 用户增长趋势 | 新增注册、DAU、WAU | 双 Y 或 normalization |
| 激活漏斗趋势 | 注册→首项目→首 Ready 各步（首 Prompt 待埋点） | 3 条线 |
| 项目生产趋势 | 新建 / Ready / Failed | 堆叠面积图可选 |
| 停留时长趋势 | 平均 Session 时长、P50/P90 | 2~3 条线 |
| 生成耗时趋势 | P50/P90 生成时长 | 识别性能回归 |

**辅助组件**

- 实时队列：`queued / running` 数量（来自 `generation_runs`）
- 最近 24h Top 错误（来自 failed runs + API 5xx 日志）
- 登录方式占比饼图（Google vs Feishu）

---

### 5.2 用户分析（`/admin/users`）

**列表页**

- 搜索：邮箱、姓名、userId
- 列：注册时间、最后活跃、项目数、Ready 数、总停留、总 Modify 次数、状态（活跃/沉默/流失）
- 筛选：注册时间段、是否激活、登录 Provider、是否内部账号

**单用户详情页**

- 基础信息 + 角色
- **停留时间轴**：按日柱状图（Studio 分钟数）
- **行为时间线**：登录、创建项目、生成、修改、预览（事件流）
- 项目列表快捷入口
- Langfuse Session 链接（按 projectId 聚合，仅 Admin）

**折线图**

- 该用户近 90 天「每日活跃分钟数」
- 该用户「累计项目 Ready 数」曲线

---

### 5.3 停留与 Engagement（`/admin/analytics/engagement`）

**核心看板**

| 模块 | 可视化 | 维度 |
|------|--------|------|
| 整体停留分布 | 直方图 | 0–1min / 1–5 / 5–15 / 15–30 / 30+ |
| 按页面平均停留 | 横向条形图 | `/`, `/studio`, `/projects/[id]`, `/auth` |
| 按功能模块停留 | 堆叠柱 | Intent / 生成进度 / Modify / Preview |
| Session 时长趋势 | **折线图** | 日均、P50、P90 |
| 深度使用用户占比 | 折线图 | 停留>10min 且 modify≥1 |
| 小时热力图 | Heatmap | 周几 × 小时 → 活跃用户数 |

**下钻**

- 按 cohort（注册周）对比停留曲线
- 按登录 Provider 对比
- 按「是否首次 Ready」对比（激活用户 vs 未激活）

---

### 5.4 激活漏斗（`/admin/analytics/activation`）

- **漏斗图**：注册 → 首 Prompt → 排队 → Running → Ready（支持步骤编辑）
- **折线图**：各步骤转化率随时间变化
- **表格**：各步骤平均耗时（如：注册到首 Prompt 中位数）

---

### 5.5 留存（`/admin/analytics/retention`）

- **留存矩阵（Cohort Table）**：注册周 × D1/D7/D14/D30
- **折线图**：不同 cohort 的 D7 留存曲线对比
- 可选：以「首次 Ready 日」为 cohort 起点（更符合产品价值）

---

### 5.6 生成与质量（`/admin/analytics/generation`）

- 成功率 / 失败原因 Top N（饼图 + 表格）
- 平均修复轮数趋势（折线）
- 按 `model_id` 分组的成功率与耗时
- Modify 次数分布（直方图）
- 单 Run 详情：steps 时间线（Gantt 式，来自 `generation_events`）

---

### 5.7 成本（`/admin/cost`，内部）

- 日 Token 消耗折线
- 每 Ready 站点平均成本
- Top 10 高成本用户/项目（需脱敏展示选项）
- 模型成本结构（堆叠面积）

---

### 5.8 系统健康（`/admin/system`）

- Worker 队列深度、平均 claim 等待时间
- Heartbeat 超时 / 僵尸 Run
- API P95 延迟（若接入 APM）
- Langfuse ingestion 延迟告警

---

## 6. 数据采集方案（需新建）

> **现状缺口**：无 `page_view` / 停留 heartbeat；需新增，否则「用户停留」只能近似推断。

### 6.1 事件模型（建议表 `analytics_events`）

```typescript
interface AnalyticsEvent {
  id: uuid;
  user_id: uuid | null;      // 未登录可为 null
  anonymous_id: string;      // cookie 级，登录后 merge
  session_id: string;        // 前端生成，30min 续期
  event_name: string;        // page_view | heartbeat | auth_success | ...
  properties: jsonb;         // path, duration_ms, project_id, provider, ...
  client_ts: timestamptz;
  server_ts: timestamptz;    // 入库时间
  ip_hash?: string;          // 合规：哈希非明文
  user_agent?: string;
}
```

### 6.2 前端采集点

| 位置 | 事件 |
|------|------|
| `app/layout` 或 middleware | `page_view` |
| Studio hook（`useBuildStudio`） | `studio_enter`, `studio_heartbeat`（每 30s） |
| Intent / Modify SSE | `intent_turn`, `modify_start`, `modify_complete` |
| Auth callback | `auth_success` + provider |
| Project ready 回调 | `project_ready`（服务端双写更准） |

### 6.3 服务端双写（高价值事件）

从现有业务表同步，避免仅依赖前端：

- `generation_runs` 状态变更 → `generation_*` 事件
- `projects.status` 变更 → `project_*` 事件
- 注册 → Auth webhook / trigger

### 6.4 聚合层（建议 `analytics_daily_rollups`）

按日预聚合，保证看板查询性能：

- `date, metric_key, dimensions(json), value`
- nightly job 或 materialized view 刷新

---

## 7. API 设计概要

| 端点 | 用途 |
|------|------|
| `POST /api/analytics/collect` | 前端批量上报（rate limit + 鉴权可选） |
| `GET /api/admin/analytics/overview?from&to` | Dashboard KPI + 折线序列 |
| `GET /api/admin/analytics/funnel?from&to` | 漏斗 |
| `GET /api/admin/analytics/retention?cohort=weekly` | 留存矩阵 |
| `GET /api/admin/analytics/engagement?from&to` | 停留分布与趋势 |
| `GET /api/admin/users/:id/analytics` | 单用户行为 |
| `GET /api/admin/projects/:id/timeline` | 单项目 Run + 事件 |

**响应格式**：沿用项目约定 `{ success, data, error, meta }`；时间序列统一 `{ date, values: { [seriesKey]: number } }`。

---

## 8. 技术选型建议

| 层 | 建议 |
|----|------|
| 图表 | Recharts 或 Tremor（与现有 shadcn 风格一致） |
| 表格 | TanStack Table + 服务端分页 |
| 聚合 | Supabase SQL + 定时 Edge Function / cron |
| 实时队列 | 直接查 `generation_runs` |
| LLM 成本 | Langfuse API + 本地缓存 |
| 导出 | CSV（Ops）；Super Admin 可 JSON |

---

## 9. 分阶段交付（建议）

### Phase 0 — 无埋点也能做（2 周）

- Dashboard：注册、项目、生成成功率、生成耗时（现有 DB）
- 项目/用户列表增强
- 队列健康页
- Langfuse 成本只读嵌入或跳转

### Phase 1 — MVP 停留与活跃（3–4 周）

- 前端 `page_view` + Studio heartbeat
- Engagement 看板：Session 时长折线、页面停留条形图
- DAU/WAU/MAU
- 单用户行为时间线（基础版）

### Phase 2 — 漏斗与留存（2–3 周）

- 完整激活漏斗 + 转化率折线
- Cohort 留存矩阵
- 内部账号过滤 + 导出审计

### Phase 3 — 深度运营（按需）

- 告警（成功率跌破阈值、队列积压）
- A/B 实验看板（若接入 feature flag）
- Support 工单联动

---

## 10. 非功能需求

| 类别 | 要求 |
|------|------|
| **性能** | Dashboard 首屏 < 2s（预聚合）；列表分页默认 20 |
| **权限** | 所有 `/api/admin/analytics/*` 校验角色；RLS 禁止普通用户读 analytics 表 |
| **隐私** | 邮箱默认部分掩码；导出需 Super Admin；GDPR 删除用户时级联 anonymize 事件 |
| **准确性** | 指标口径文档化；前后端双写事件以服务端为准 |
| **可用性** | 时间范围、对比周期、导出 CSV 为标配交互 |

---

## 11. 待确认的问题（评审清单）

1. **North Star**：首 24h Ready 率 vs D7 留存 vs 每用户 Modify 次数 — 选一个主指标？
2. **停留口径**：Session 超时 30min 是否合适？是否跨天强制切 Session？
3. **未登录用户**：首页浏览是否计入 DAU / 停留（通常单独「访客分析」）？
4. **内部账号**：哪些邮箱域名 / 用户 ID 永久排除？
5. **成本模块**：是否仅 Super Admin 可见？是否需要按项目分摊给未来商业化？
6. **实时性**：接受 T+1 聚合，还是关键指标要近实时（5min）？
7. **Langfuse**：成本看板是 API 拉取还是 nightly sync 到本地表？
8. **导出范围**：Support 能否导出单用户时间线？是否需要审批流？
9. **告警渠道**：飞书 Webhook / Email / 仅站内？
10. **与现有 `/admin` 关系**：合并为一个 Admin Shell（侧边栏导航），还是独立 `/admin/analytics` 子应用？

---

## 12. 与现有代码的映射（落地参考）

| 已有能力 | 后台可直接用 |
|----------|--------------|
| `app/admin` + `user_roles` | 权限框架 |
| `projects` / `generation_runs` / `generation_events` | 生成质量、耗时、队列 |
| `projects.total_duration` | 生成耗时近似 |
| `modification_history` | Modify 次数 |
| Langfuse `sessionId = projectId` | 单项目 LLM 追踪下钻 |
| Google / Feishu Auth | 登录 Provider 维度 |

| 缺失 | 需建设 |
|------|--------|
| `analytics_events` 表 | 停留、PV、Session |
| 日聚合表 / job | 看板性能 |
| Admin 图表页 | UI |
| `admin_audit_logs` | 合规 |

---

## 13. 验收标准（Phase 1 示例）

- [ ] Admin 登录后可见 Dashboard，展示近 30 天「新增注册、DAU、Ready 项目数」折线图
- [ ] Engagement 页展示 Session 平均时长折线 + 页面停留 Top 5 条形图
- [ ] 用户详情页可查看该用户近 30 天每日 Studio 停留分钟数
- [ ] 所有指标支持 7/30/90 天切换
- [ ] 非 Admin 访问返回 403
- [ ] 指标口径在 UI 上有 ⓘ tooltip 说明

---

## 修订记录

| 日期 | 修订说明 |
|------|----------|
| 2026-06-15 | 初版：后台管理系统 PRD |
