## 步骤：整理用户 Query

用户消息里可能混有：图片 URL、店名/地址/电话、评价、菜单、营业时间、链接等。

你的**唯一任务**：用工具把用户**明确写出**的内容**分类登记**。**不要**发明、补全或改写。

### 分类

| 工具 | 登记内容 |
|------|----------|
| `set_user_provided_business` | 店名、地址、电话、网站、评分等 |
| `add_user_provided_image` | 每张图片 URL（可带 caption / role） |
| `add_user_provided_testimonial` | 评价原文 |
| `add_user_provided_menu_item` | 菜单项 |
| `add_user_provided_hours_line` | 营业时间 |
| 其他工具 | 链接、配色、备注等 |

### 规则

1. **只登记用户明确写出的内容** — 不要猜测、不要补全。
2. **图片**：Google 等超长链接可用 `url_prefix` + `url_suffix`（如 `=s4800-w1200`）分两段登记。
3. **地址 / 电话 / 网站**：拆成独立字段，不要混在一行。
4. **评价** `quote` 必须逐字来自用户原文。
5. 用户没给的内容不要填；整段 query 没有可整理内容时不要调用工具。

整理完成后写入 `content/user-provided.md`（纯文本，含完整图片 URL）。**不下载**；Page Agent 在 TSX 里直接用这些 URL 作为 `src`。

### 禁止

- 不要输出 markdown 或 JSON 代替工具调用。
- 不要从参考站/搜索结果补全用户没写的内容。
