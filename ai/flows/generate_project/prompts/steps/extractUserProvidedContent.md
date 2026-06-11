## 步骤：整理用户 Query

用户消息里可能混有：图片 URL、店名/地址/电话、评价、菜单、营业时间、链接等。

你的任务：用工具把用户**明确写出**的内容**分类登记**。**不要**发明、补全或改写。

> **图片 URL 已由系统在调用你之前从原文扫描登记。** 你只需：  
> 1) 用 `add_user_provided_image` **补 caption / role**（若用户原文有说明）；  
> 2) 登记工具返回里**没有**的遗漏 URL；  
> 3) 登记 business / 评价 / 菜单 / 营业时间等**非 URL** 字段。

### 分类

| 工具 | 登记内容 |
|------|----------|
| `set_user_provided_business` | 店名、地址、电话、网站、评分等 |
| `add_user_provided_image` | 补 caption/role，或登记遗漏的图片 URL |
| `add_user_provided_testimonial` | 评价原文 |
| `add_user_provided_menu_item` | 菜单项 |
| `add_user_provided_hours_line` | 营业时间 |
| 其他工具 | 链接、配色、备注等 |

### 规则

1. **只登记用户明确写出的内容** — 不要猜测、不要补全。
2. **图片 URL**：若已在系统中登记，**不要重复** `add_user_provided_image` 同一 URL；只补 `caption` / `role`。遗漏的长 Google 链接可用 `url_prefix` + `url_suffix`（如 `=s4800-w1200`）。
3. **地址 / 电话 / 网站**：拆成独立字段，不要混在一行。
4. **评价** `quote` 必须逐字来自用户原文。
5. 用户没给的内容不要填；整段 query 没有可整理内容时不要调用工具。

整理完成后写入 `content/user-provided.md`（纯文本，含完整图片 URL）。**不下载**；Page Agent 在 TSX 里直接用这些 URL 作为 `src`。

### 示例（用户原文 → 工具 → 落盘形态）

**用户原文片段：**

```text
Address: 5260 N Clark St, Chicago, IL 60640
Phone: (773) 555-0100

Images: https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto1=s4800-w1200 — main bar interior
https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto2=s4800-w1200 — patio seating

TESTIMONIAL: "Best Guinness in town." — Pat M., 5 stars
```

**系统已扫描登记 2 条图片 URL 后，你应调用：**

```text
set_user_provided_business({ address: "5260 N Clark St, Chicago, IL 60640", phone: "(773) 555-0100" })
add_user_provided_image({ url: "...Photo1=s4800-w1200", caption: "main bar interior" })
add_user_provided_image({ url: "...Photo2=s4800-w1200", caption: "patio seating" })
add_user_provided_testimonial({ quote: "Best Guinness in town.", author: "Pat M.", stars: 5 })
```

**最终 `content/user-provided.md` 形态：**

```markdown
# User-provided content

## Business
Address: 5260 N Clark St, Chicago, IL 60640
Phone: (773) 555-0100

## Images (each URL once as remote src; ...)
1. URL: https://lh3.googleusercontent.com/...Photo1=s4800-w1200
   Caption: main bar interior
2. URL: https://lh3.googleusercontent.com/...Photo2=s4800-w1200
   Caption: patio seating

## Testimonials
- "Best Guinness in town." — Pat M., 5 stars
```

### 禁止

- 不要输出 markdown 或 JSON 代替工具调用。
- 不要从参考站/搜索结果补全用户没写的内容。
- 不要重复登记系统已扫描的同一条图片 URL（无 caption 更新时）。
