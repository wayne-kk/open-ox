# Cyberpunk / Glitch 全壳换肤 — 已确认决策（v1）

**状态**：已确认（grilling 2026-07-10）  
**设计系统**：用户提供的 Cyberpunk / Glitch Design System  
**非范围**：Studio、Admin、Docs、`sites/template` 生成站

## 锁定决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 覆盖面 | 产品壳：`/`、`/projects`、`/community`、Nav/AppShell/Footer、Auth |
| 2 | 强度 | Token 全壳换；强特效集中营销 `/` + 关键壳 |
| 3 | Token | `--primary`/`--accent` → `#00ff88`；secondary magenta；tertiary cyan；`bitcoin-gradient-text` 换实现不改名 |
| 4 | 字体 | Orbitron（标题）/ JetBrains Mono（正文）/ Share Tech Mono（标签） |
| 5 | 圆角 | 全局尖；chamfer 用于营销/关键控件；列表卡轻处理 |
| 6 | Scanline | 仅 `/` + Auth |
| 7 | HeroPrompt | 终端 `>` + chamfer + neon focus；功能不变 |
| 8 | Auth | 完整换肤 + scanline |
| 9 | 硬编码橙 | 范围内清掉；Studio/Admin 不动 |
| 10 | 交付顺序 | token→营销→壳→列表轻换→Auth |
| 11 | 中文 | 标题不强行 uppercase；英文 eyebrow/标签 uppercase |

## 交付步骤

1. `globals.css` + `layout.tsx` 字体 + utility（neon/chamfer/glitch/scanline，`prefers-reduced-motion`）
2. 营销 `/` 强特效
3. Nav / AppShell / Footer / HeroPrompt
4. `/projects` + `/community` 轻换 + 清硬编码橙
5. Auth
