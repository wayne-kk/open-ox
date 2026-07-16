# PRD / Plan：视觉信号修复 + Agent 膨胀收敛

**Status:** Implemented (2026-07-16)  
**Date:** 2026-07-15  
**依据:** `.open-ox/agent.log` 美术馆单页 run + Page Agent 诊断 + Agent/Subagent 架构调研  

**产品判断：** Keywords 污染、废弃 Hero Skill、Scaffold 字体脱节会直接伤视觉；同时 **Agent / 提示词越滚越大**（角色堆叠 + 单次上下文膨胀）会稀释注意力、逼模型折中，同样伤效果。本 PRD 把两类问题放在同一交付里。

## 范围（用户取舍）

| # | 项 | 本计划 |
|---|----|--------|
| 1 | 默认 Design Keywords 污染 | **必须改** |
| 2 | Hero Skill 选型 | **删除整条路径**（已废弃） |
| 3 | Chrome Scaffold 字体脱节（Inter） | **改** |
| 8 | **Agent 越滚越大（上下文/规则膨胀）** | **改（见 §4）** — 认为影响视觉效果 |
| 4 | DS ↔ Infer / 硬规则互掐 | **代办**，不改代码 |
| 5 | Page Agent 提示词偏工程（文风大改） | 不处理（§4 用预算/摘要收敛体积，不重写审美文案） |
| 6 | 「无视觉闭环」 | **见说明，记代办，不改代码** |
| 7 | Intent 气质选择器 | 不处理 |

### 第 6 点含义（只解释，不实现）

「无视觉闭环」= Page Agent 写完文件后，流水线**不会**再「看一眼成品再改」：没有截图/浏览器预览，也没有「首屏是否空、是否奶油一片、字体是否落地」的 critique 轮；只有 `read_lints` / build。

本计划**不接**视觉 Verifier；见 [issues/02-visual-closed-loop.md](./issues/02-visual-closed-loop.md)。

---

## 问题拆解：两类「越滚越大」

| 类型 | 症状 | 对视觉的影响 |
|------|------|----------------|
| **A. 角色 sprawl** | 每出一类问题就加 `*Agent.md` / 编排步 | 延迟↑、信号多源打架、维护成本↑ |
| **B. 上下文膨胀** | Page system = frontend + step + 6–8 rules；bootstrap 再塞 DS 12k + layout + globals | 注意力被流程/禁令吃掉，Bold Factor 难落地，表现为「安全奶油纸」 |

原则（与调研一致）：**新能力默认不是新 Agent**；确定性 → Pipeline Step；短规程 → 条件加载 rule/skill；噪声 → Subagent；仅所有权/禁写/对用户说话者变化才新增 Role Worker。**禁止**用「再加 Visual/Hero/Critique Agent」当默认解法。

---

## 1) 默认 Design Keywords 污染（P0）

### 根因

1. `analyze` 不写 `experience` → `runGenerateProject.ts` 与 `normalizeBlueprint.ts` 填入 SaaS 默认：`clean, professional, focused, confident, modern`。
2. Infer 的真实 keywords 要到 **Plan 之后**才 merge，Plan 的 user 消息已经吃到污染词。

### 改法

1. **删掉 SaaS 默认**  
   - `normalizeExperience`：缺省时 keywords 为 `[]`，禁止再写那五个英文词。  
   - `runGenerateProject` 里 `if (!rawBlueprint.experience)` 同步改为中性空结构。
2. **Plan 之前注入 Infer**  
   - 在 `normalizeBlueprint` / `plan_project` **之前**：用 `inferredDesignIntent.technicalKeywords`（及用户已确认的 Studio 气质 keywords）写入 `experience.designIntent.keywords`。  
   - 用户确认气质 **优先**于 Infer。  
   - 收窄「Plan 后再 merge」的重复逻辑。
3. **Plan 提示**  
   - keywords 为空时写明「只信 brief 的视觉与参考」，禁止脑补 clean/modern。
4. **测试**  
   - normalize：无 experience → keywords `[]`。  
   - 有 Infer keywords 时，进入 Plan 的 blueprint 已含这些词、且不含默认五词包。

---

## 2) 移除 Hero Skill 选型（P0）

不重试选型，**整条路径删除**（同时减一轮失败 LLM / A 类膨胀）。

1. `runGenerateProject.ts` `generatePages`：删除 `discoverAndSelectSkill` 等调用；不再传 `heroSkillPrompt` / `heroSkillId`。
2. `pageImplementAgent` / `pageAgentBrief` / `pageAgentBootstrap`：去掉 `content/hero-skill.md` 落盘与 bootstrap 引用。
3. 停止生产引用 `heroSkillSelection.ts`（可标 `@deprecated`）。
4. 更新相关测试；trace 不再出现 `pick_hero_section_component_skill`。

Page Agent 仅依赖：brief + `pageDesignPlan` + design-system / Visual Contract + tokens。

---

## 3) Chrome Scaffold 字体跟随 tokens（P0）

1. `buildMinimalChromeRootLayout`（`chromeAgentCommon.ts`）：去掉 Inter；body 使用 `var(--font-body)` + 中文 fallback。
2. `architectScaffoldAgent.md`：禁止再 `import { Inter }`；字体来自 design tokens / `font-body`。
3. 单测：生成 layout 不含 `Inter`。

---

## 4) Agent / 提示词膨胀收敛（P0，影响效果）

本批只做 **B 类高杠杆**（上下文变瘦）；A 类中期项记代办，不在本 PRD 大改编排拓扑。

### 4.1 Visual Contract + 缩短 Page bootstrap（必做）

**现状：** `pageAgentBootstrap` 默认注入完整 `design-system.md`（上限约 12k）+ layout + globals，与一长串 system rules 叠在一起。

**改法：**

1. Design System 生成步骤增加稳定小节：`## Visual Contract (agent)`（或等价机器可读块），至少含：  
   - 色板角色（background / foreground / primary / muted… hex）  
   - 三字体角色（display / header / body）  
   - **Bold Factor 至多 5 条**可验证约束  
   - Hero / 表面节奏各 1–2 句  
2. Page bootstrap **默认只注入该摘要**（再加 layout 节选 + globals 节选），**不再**默认塞满整份 DS。完整 `design-system.md` 仍落盘，Agent 可按需 `read_file`。  
3. 去掉 Hero skill 后，bootstrap 不再为 skill 预留 10k 槽位。

### 4.2 冻结 Page base rule 列表（必做）

落点：`agentRuleBundles.ts` 的 `PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE`。

- 注释写明：**新增 rule 必须替换或改为条件加载，禁止只 append。**  
- 加轻量测试/断言：base 列表长度有上限，或 compose 后 Page system（不含 bootstrap）字符数有阈值（建议规则正文约 8–12k 量级，实现时按现网测一次定阈值）。  
- `PAGE_IMPLEMENT_AGENT_EXTRA_RULES` 仍可用，但不算「默认可无限长」。

### 4.3 本批明确不做（记代办）

见 [issues/03-agent-sprawl-followups.md](./issues/03-agent-sprawl-followups.md)：

- 统一 Generate/Modify Agent Runtime  
- 全面上 explore/verifier subagent（噪声隔离）  
- 合并双 Intent / orphan architect 命名  
- 把每个 section 拆成并行 subagent（禁止作为默认解法）

---

## 代办（本计划不改代码）

见 `issues/`：

- `01-ds-hard-rule-conflicts.md` — DS ↔ Infer / 硬规则互掐（**已实现**：单一审美权威；短改 prompt + 静态测试）  
- `02-visual-closed-loop.md` — 视觉闭环产品未定  
- `03-agent-sprawl-followups.md` — Runtime 统一、subagent、双 Intent 等中期项  

---

## 验收

**信号正确性**

- 「美术馆 / 纸质」类 brief：Plan 输入关键词为 Infer/用户词，**不含**默认五词包。  
- Trace **无** `pick_hero_section_component_skill`。  
- Scaffold `app/layout.tsx` **无 Inter**，body 用 token 字体。  

**膨胀收敛**

- Page bootstrap 默认**不含**完整 DS 长文；含 Visual Contract（或等价短摘要）。  
- Page base rule 列表有冻结说明 + 体积/长度断言绿。  
- 相关 vitest 通过。

---

## 实现 todos

1. `fix-keywords` — SaaS 默认清除 + Plan 前注入 Infer/用户词  
2. `remove-hero-skill` — 删除选型与落盘路径  
3. `scaffold-fonts` — layout 去 Inter，跟 `font-body`  
4. `visual-contract-bootstrap` — DS 产出 Visual Contract；Page bootstrap 改注摘要  
5. `freeze-page-rules` — 冻结 base rule + 体积/长度断言  
6. `backlog-note` — issues 01/02/03 保持文档完整  
