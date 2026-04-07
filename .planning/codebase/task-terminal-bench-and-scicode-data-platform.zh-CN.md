# 任务执行文档（中文）: Terminal-Bench + SciCode 数据平台

## 1. 文档目的

本文件用于指导后续研发，把当前 Open-OX 从“AI 建站系统”升级为“可采购的数据生产平台”，支持两类核心数据：

1. **Agentic 轨迹数据**（Terminal-Bench 风格，多轮、可评测、可复现）。
2. **单轮科学编程数据**（SciCode 风格，严格结构化、含 sub_steps 和 tests）。

这是一份**可执行的工程任务文档**，不是概念说明。

---

## 2. 当前状态评估

### 2.1 已具备能力

- 已有 AI 流程与 SSE 步骤流（`/api/ai`）。
- 已有沙箱基础（E2B 相关能力）。
- 已有 Supabase 持久化能力。
- 已完成初版 trajectory 表与事件写入能力（`trajectory_runs` / `trajectory_events`）。

### 2.2 关键缺口

- 缺少标准化任务包（goal/setup/tests/success criteria）。
- 缺少命令级全量轨迹采集闭环（command/stdout/stderr/exit code）。
- 缺少统一 evaluator 与评分结构。
- 缺少 SciCode 数据模型、上传校验、执行验证。
- 缺少 canary/脱敏/导出审计机制。

---

## 3. 总体目标（最终交付）

项目完成后应满足：

1. **Agentic 数据可采购**：每次 run 都有完整轨迹、可回放、可评分、可导出。
2. **SciCode 数据可采购**：问题结构严格校验，sub_steps + tests 可执行可验收。
3. **数据治理可审计**：有 canary、脱敏标记、版本与导出清单。

---

## 4. 范围定义

### 4.1 本次范围（In Scope）

- Agentic 任务模型、运行模型、评测模型。
- `/api/ai` 与 trajectory 自动打通。
- SciCode 数据入库、校验、执行验证。
- 数据导出与治理字段。

### 4.2 暂不纳入（Out of Scope）

- 多租户计费系统。
- 完整数据交易前台 UI。
- 大规模分布式调度（先保留单机/轻量 worker）。

---

## 5. 分阶段执行计划

## Phase A：Agentic 基础闭环（优先级最高）

### A.1 数据库设计

新增/扩展表：

1. `task_specs`（任务包定义）
- `task_id` (PK)
- `domain` (`software_engineering | sysadmin | ml | security | data_science`)
- `goal` (text)
- `setup` (jsonb)
- `tests` (jsonb)
- `success_criteria` (jsonb)
- `constraints` (jsonb, 可选)
- `difficulty` (可选)
- `created_at` / `updated_at`

2. `trajectory_runs`（已存在，补充字段）
- `run_id` / `task_id`
- `schema_version`
- `status` (`running | finished`)
- `last_seq`
- `sandbox_provider` / `sandbox_id` / `image_ref`（可选但建议）
- `started_at` / `ended_at`
- `created_at` / `updated_at`

3. `trajectory_events`（已存在）
- `run_id` / `seq`
- `event` (jsonb)
- `created_at`
- 唯一约束 `(run_id, seq)`

4. `evaluator_runs`
- `id` (PK)
- `run_id` (FK)
- `verdict` (`passed | failed | partial`)
- `score` (jsonb)
- `failure_type` (nullable)
- `summary` (text)
- `created_at`

### A.2 API 设计

实现以下接口：

- `POST /api/tasks`：创建任务包
- `GET /api/tasks/[taskId]`：获取任务包
- `POST /api/trajectories`：启动 run
- `POST /api/trajectories/[runId]/events`：追加事件
- `POST /api/trajectories/[runId]/evaluate`：执行评测并写入 `run_end`
- `GET /api/trajectories/[runId]`：返回 run + events + evaluator 结果

### A.3 与现有 `/api/ai` 打通

必须接入：
- run 开始写 `run_start`
- 每个关键步骤写 `message/checkpoint/test_result`
- 报错写 `error`
- 结束写 `run_end`

关键原则：
- 序列号 `seq` 由服务端控制
- `run_end` 后禁止写入新事件
- 失败事件不可丢弃

### A.4 验收标准

- 每个 run 至少包含：`run_start` + 中间执行/测试事件 + `run_end`
- `seq` 连续且唯一
- run 可完整查询与回放
- evaluator 结果可追溯到 run

---

## Phase B：Agentic 质量增强与治理

### B.1 增加治理字段

在 run/meta 中补充：
- `canary_id`
- `pii_redaction` (bool)
- `data_source` (`human | agent | hybrid`)
- `model_id`（可选）
- `replayable` (bool)

### B.2 脱敏流程

在入库或导出前执行：
- key/token/credential 模式识别
- 环境变量敏感值替换
- 常见 secret pattern 屏蔽

### B.3 导出能力

输出：
- 按 run 的 JSONL（有序事件）
- manifest（schema 版本、时间范围、样本数、hash）
- evaluator 摘要

### B.4 验收标准

- 随机抽样导出数据不含明文密钥
- 全量 run 均含治理字段
- JSONL 可直接用于下游训练/评测管道

---

## Phase C：SciCode 单轮数据管道

### C.1 数据模型

1. `scicode_problems`
- `problem_id` (PK)
- `problem_name`
- `problem_description_main`
- `problem_io`
- `required_dependencies`
- `general_tests` (jsonb)
- `domain` / `difficulty` / `tags` (jsonb)
- `created_at` / `updated_at`

2. `scicode_sub_steps`
- `id` (PK)
- `problem_id` (FK)
- `step_number`
- `step_description_prompt`
- `function_header`
- `test_cases` (jsonb)
- `return_line`
- unique `(problem_id, step_number)`

3. `scicode_validation_runs`
- `id` (PK)
- `problem_id`
- `status`
- `result` (jsonb)
- `created_at`

### C.2 API 设计

- `POST /api/scicode/problems`：上传问题（严格校验）
- `GET /api/scicode/problems/[problemId]`：读取问题
- `POST /api/scicode/problems/[problemId]/validate`：执行验证
- `GET /api/scicode/problems`：按领域/难度/标签筛选

### C.3 严格校验规则

必须校验：
- 顶层必填字段齐全
- `sub_steps` 非空
- 每个 `sub_step` 必须含：
  - `step_number`
  - `step_description_prompt`
  - `function_header`
  - `test_cases`（非空）
  - `return_line`
- `general_tests` 非空
- 依赖字段可解析

### C.4 验收标准

- 错误输入返回明确字段路径
- 正确输入无损 round-trip
- 每次验证有分步结果与总结果

---

## 6. 统一数据契约（必须遵守）

### 6.1 Agentic 事件统一字段

每条 event 必须包含：
- `schema_version`
- `task_id`
- `run_id`
- `event_id`
- `seq`
- `ts`
- `phase`
- `event_type`
- `actor`
- `payload`
- `meta`

### 6.2 SciCode 问题统一字段

顶层：
- `problem_name`
- `problem_id`
- `problem_description_main`
- `problem_io`
- `required_dependencies`
- `sub_steps`
- `general_tests`

子步骤：
- `step_number`
- `step_description_prompt`
- `function_header`
- `test_cases`
- `return_line`

---

## 7. 可执行任务拆分（工程层）

1. **Migration**
- `008_task_specs_and_evaluator.sql`
- `009_scicode_tables.sql`

2. **Lib 层**
- `lib/tasks/*`（任务包校验与 CRUD）
- `lib/trajectory/*`（扩展 evaluator/export）
- `lib/scicode/*`（schema 与执行器）

3. **API 层**
- 任务、轨迹、评测、scicode 上传与验证接口

4. **运行时接入**
- `/api/ai` 自动写 trajectory
- 失败情况下 best-effort + 最终态强一致

5. **质量保障**
- schema 单测
- run 生命周期集成测试
- 导出样本审计测试

---

## 8. QA 检查清单（上线前）

- [ ] 可创建并读取任务包
- [ ] 可启动 run 并持续追加事件
- [ ] `run_end` 后写入被拒绝
- [ ] evaluator 可产出 verdict + score
- [ ] 导出 JSONL 顺序正确且可解析
- [ ] SciCode 非法结构可被拦截
- [ ] SciCode 验证结果包含 sub_step 级细节
- [ ] 脱敏钩子生效，无明文敏感信息

---

## 9. 风险与应对

1. **高并发下事件乱序或丢失**
- 应对：数据库唯一约束 + 重试 + 幂等键。

2. **评测结果不稳定**
- 应对：固定镜像版本、固定依赖、固定随机种子（可选）。

3. **日志泄露敏感信息**
- 应对：写前/导出前双重脱敏 + canary 审计。

4. **schema 演进导致兼容问题**
- 应对：强制 `schema_version` + 迁移说明。

---

## 10. 建议排期（4周）

- **第1周**：Phase A（task spec + trajectory + `/api/ai` 基础接入）
- **第2周**：evaluator + 导出 + 治理字段
- **第3周**：SciCode 表结构 + 上传校验
- **第4周**：SciCode 验证执行 + 全链路 QA

---

## 11. 完成定义（Definition of Done）

以下三条同时满足才算完成：

1. Agentic run 可完整采集、评测、导出。
2. SciCode 问题可严格入库并可执行验证。
3. 数据具备采购级治理要素（canary、脱敏、审计字段）。

---

## 12. 本仓库落地注意事项

- 以增量方式接入，不破坏现有建站主流程。
- 轨迹采集优先结构化事件，不依赖自由文本日志。
- 非关键路径可 best-effort，最终 verdict 必须强一致持久化。
- schema 与校验逻辑集中管理，避免多处漂移。

