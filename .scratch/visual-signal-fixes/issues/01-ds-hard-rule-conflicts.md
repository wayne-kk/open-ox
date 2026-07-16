# 01 — Design System ↔ Infer / 硬规则互掐

**Status:** Implemented (2026-07-16)  
**Type:** task  
**Priority:** 美观性第一；工程稳定性次之  

## Problem

Infer / Design System 与 `section.default` 硬规则互相打架，模型被迫折中，削弱画册/纸质等方向的执行力。已观察到的冲突包括：

- Infer 写纸张 Grain ↔ DS Hard Rule / `section.default` 禁止 grain/noise  
- DS Hero `py-24~py-32`、`mb-32` ↔ `section.default` 禁止 `py-32`、外层最大 `py-24`  
- Editorial 大标题欲望 ↔ H1 ≤ `text-5xl`（DS Hard Rules **与** `section.default` 双边锁死）  
- Hero skill 菜谱常用 `md:text-6xl` / grain overlay ↔ Page system 硬禁

## Decision（已采纳）

**单一审美权威 + 规则分层。**

| 层 | 内容 | 归属 |
|----|------|------|
| **工程不变量** | 编译/SSR、`data-ox-id`、图像工具契约、假路径、语言、`outputTsx` | `section.default` / `outputTsx` — 永久硬 |
| **审美策略** | 字号、间距、纹理、Hero 节奏、grain 是否允许 | **本 run 的 DS / Visual Contract** — 可变、可大胆 |

**冲突裁决（须写入 Page Agent）：**

```text
Visual Contract（含 Bold Factor）
  > Design System tokens / 配方
  > section.default 工程线
  > 泛用 anti-slop
```

禁止再让 `section.default` 与 DS Hard Rules **双向互禁**同一类视觉手段。  
禁止用「再加 Visual/Critique Agent」来和解。

---

## 可执行改 prompt 清单

### A. [`section.default.md`](../../../ai/flows/generate_project/prompts/rules/section.default.md)

**A1. 拆分「硬性禁止」标题**

- 保留小节 `### 硬性禁止（工程 — 必须遵守）`
- 新增 `### 审美默认（可被 Visual Contract 覆盖）`（或直接删除审美硬天花板）

**A2. 从硬禁移出 / 删除（美观优先）**

| 现条款 | 动作 |
|--------|------|
| 禁止标题 `> text-5xl` | **删除硬禁**。改为：默认 `≤ text-5xl`；若 Visual Contract / Bold Factor 写明 display 更大，允许至 `text-6xl`/`text-7xl`（仅 `font-display` 的 H1） |
| 禁止外层 `py > py-24` 及 `py-32`/`py-40` 包装类 | **删除硬禁**。改为：常规 section 偏好 `py-12~py-24`；Hero / 宣言带以 Visual Contract 为准，可 `py-28~py-40` |
| 禁止区块内页面级颗粒/噪声/扫描线/暗角 | **降级**：无 Contract 依据时禁止全页糊脸；若 Contract / DS 指定「纸质微粒 / film grain」，允许 **局部、低透明（约 3–8%）、`pointer-events-none`** 的 CSS/SVG noise，禁止无依据叠多层 |

**A3. 工程硬禁保留**

- `outputTsx` / 禁滥用 styled-jsx  
- `clip-path` / `polygon` / 有机异形剪裁（若日后要开放异形，另开 issue；本批不动）  
- 假 `bg-[url('...')]`、emoji 文案、灰阶悬停解锁原图、图片 `hover:scale` 大动效  
- 默认三等分功能卡片行（anti-slop，属质量不是字号）  
- TS 安全、`data-ox-id`、语言、图像工具契约  

**A4. 「区块视觉节奏」微调**

- 「若页面整体已带颗粒…区块内不要再叠」→ 改为：以 Visual Contract 为准；同一视口最多一层 noise veil。

---

### B. [`generateProjectDesignSystem.md`](../../../ai/flows/generate_project/prompts/steps/generateProjectDesignSystem.md)

**B1. Hard Rules：审美上限改为信封**

| 现条款 | 动作 |
|--------|------|
| `H1 max size: text-5xl. Never text-6xl` | **删除绝对禁止**。改为：默认 H1 ≤ `text-5xl`；若气质需要 editorial 大标题，须在 **Visual Contract → Bold Factor** 写明允许的 max（如 `font-display` + `md:text-6xl`），并在 Typography Scale 表中一致 |
| `No grain, noise, scanlines… solid color only` | **删除一律禁止**。改为：默认不用全站 fixed noise；若 vibe 需要纸质/胶片，在 Visual Contract +（可选）Textures 小节规定 **何处 / 何种 / 透明度上限**；禁止无映射的「随便糊一层」 |
| `Do NOT include noise/grain`（Special Effects 段） | 与上对齐：允许 **documented** 纹理，禁止未写入 Contract 的特效 |

**B2. Typography / Section rhythm 示例放宽**

- Scale & Styling 中「H1 must not exceed text-5xl」→ 与 B1 同口径（默认 vs Contract 特许）。  
- Hero 垂直节奏示例可含 `py-20~py-32`（不再被下游硬打脸）。  
- Visual Contract 示例里的 Bold Factor：把「max text-5xl」改成「写清本 run 的真实上限」，避免模板教模型永远封顶。

**B3. Global Prohibitions**

- 保留：禁纯白底、禁默认蓝、禁无签名的圆角卡+软阴影、禁 font-role 互换、禁 clip-path（与工程线一致）。  
- 不在此重复 py/字号黑名单。

---

### C. Page Agent 优先级一句

文件：[`pageImplementAgent.md`](../../../ai/flows/generate_project/prompts/steps/pageImplementAgent.md)（或 `pageAgentBrief` 短注）

追加约 3–5 行：

- 审美以 **Visual Contract / Bold Factor** 为最高权威。  
- `section.default` 的工程硬禁不可破；其「审美默认」可被 Contract 覆盖。  
- 不要为了「安全合规」主动压到 cream SaaS / 一律 `text-5xl` / 一律 `py-24`，若 Contract 要求更大胆。

---

### D. 测试 / 验收（本 issue 实现时做）

1. Prompt 静态检查（可选 vitest）：`section.default` 硬禁段 **不再** 含「禁止大于 text-5xl」「禁止 py-32」字面硬锁。  
2. DS prompt Hard Rules **不再** 含「Never text-6xl」「No grain…solid only」绝对句。  
3. 回归 brief（美术馆 / 纸质）：生成的 Visual Contract 允许更大 display 或微粒时，Page 输出不应被 system 规则口头否决。  
4. 工程线仍在：假路径、无 `data-ox-id`、灰阶悬停解锁仍应被禁止。

---

## Out of scope（本 issue 仍不做）

- 开放 `clip-path` / 有机异形（另议）  
- 视觉闭环 Verifier（见 `02-visual-closed-loop.md`）  
- 重写 Page 审美长文风（#5）  
- 恢复 Hero Skill 选型  

## Comments

- 2026-07-16：产品确认「美观性第一」；采纳单一审美权威 + 工程/审美分层；清单待实现。
- 2026-07-16：已落地短改 — `section.default` / `generateProjectDesignSystem` / `pageImplementAgent`；`aestheticAuthority.prompt.test.ts` 锁冲突句不再回潮。
