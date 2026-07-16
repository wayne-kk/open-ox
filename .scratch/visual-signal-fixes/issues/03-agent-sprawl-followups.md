# 03 — Agent sprawl 中期跟进（本 PRD 不做）

**Status:** backlog  
**Type:** task  

## 已在本 PRD 做的（见主 PRD §4）

- Visual Contract + 缩短 Page bootstrap  
- 冻结 Page base rule 列表 + 体积断言  
- 删 Hero skill、Keywords 单一真相源（间接减膨胀）

## 本 issue 跟踪的后续项

1. **统一 Agent Runtime** — Generate `toolLoop` 与 Modify `loopEngine` 能力下沉，少复制「又一个 loop agent」。  
2. **克制 Subagent** — 仅 explore / verifier / 噪声隔离；父上下文不因搜索/验收变胖。  
3. **合并重复入口** — 双 Intent、orphan `architectAgent` 命名等。  
4. **条件 rule 加载扩展** — screenshot / a11y 等继续「有条件才叠」，保持 base 瘦。  

## 明确禁止作为默认解法

- 再加 Visual / Hero / Critique Agent 却不删旧路径  
- 每个 section 并行独立 subagent  

## Comments
