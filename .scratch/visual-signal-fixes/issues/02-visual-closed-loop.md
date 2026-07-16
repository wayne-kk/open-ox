# 02 — 视觉闭环（含义说明 / 产品未定）

**Status:** backlog  
**Type:** task  

## 含义（给产品）

「无视觉闭环」**不是** Page Agent 没写完，而是：

写完 TSX 之后，流水线**没有**「看一眼成品 → 按视觉清单改一轮」：

- 没有截图 / 浏览器预览  
- 没有「首屏是否空、奶油一片、字体是否落地、双重导航」类 critique  
- 只有 `read_lints` / typecheck / build（工程验收 ≠ 视觉验收）

可选后续形态（未决定）：Page 写完后跑只读视觉 Verifier subagent（报告模式），或强制一轮「视觉 polish」edit。

## Out of scope for current PRD

本项不改代码，仅文档化。

## Comments
