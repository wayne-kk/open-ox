关于这个角色

让 Agent 真正有用，不是让它更聪明 —— 是让它记住你。

记住你上周说的决定、你反复提到的偏好、你三个月前犯过的错误。现有的 Agent 系统大多在每次对话结束后彻底失忆。我们认为这是 AI 应用基础设施层最值得解决的问题之一。

我们的目标是让每个 Agent 拥有可检视的记忆、可追溯的证据链、可委托的身份 —— 成为 Web 的一等公民。这个角色负责构建记忆系统的核心基础设施：从原始对话到结构化记忆的抽取、存储、召回与上下文组装，让 Agent 跨会话、跨任务地保持连贯认知。

核心职责

1、记忆写入与语义抽取：消息 / 行为数据的异步写入、LLM 驱动的语义抽取、结构化记忆生成（用户画像、事件记忆、事实记忆）与可追溯证据链管理

2、分层记忆建模：长期记忆与短期上下文的分层架构设计；跨会话记忆的合并、冲突解决、置信度衰减、时效性管理与遗忘策略

3、开发者平台与 SDK：设计并维护面向第三方开发者的 Memory SDK（Python / TypeScript），包括 API 接口设计、多语言 Client 封装、OpenAPI 规范、交互式文档与 Playground；负责 SDK 的版本管理、兼容性策略与 Changelog；构建 CLI 工具链，支持开发者本地调试、记忆可视化检视与 diff；设计多租户隔离模型、API Key 管理、Quota 限制、用量统计与计费钩子；与 MCP（Model Context Protocol）等 Agent 协议保持兼容，支持 Agent 框架（LangChain / LlamaIndex / AutoGen 等）的一键集成

4、多路召回与上下文组装：关键词 / 向量 / 图谱关系 / 本体多路召回，实体 / 时间 / 标签过滤，rerank，以及在 token budget 约束下的上下文精确组装

异步 Pipeline 体系：任务调度、队列消费、幂等、重试、租约、失败恢复、同用户串行化与延迟治理

5、LLM 抽取链路工程：结构化输出校验与修复、Prompt 版本管理、token / cost 统计、失败降级

6、API、权限与可观测：多租户隔离、记忆写入与召回的完整 trace、Worker 与依赖调用的生产级可排障能力

岗位要求

1、深入理解现代 Agent Memory 架构：基于向量 + 图的 Cloud Memory 方案、基于 Markdown 的 Local Memory 方案、记忆分层模型与 Context Engineering

2、熟练掌握 Memory 系统核心机制：语义抽取、召回排序、记忆合并与冲突解决、遗忘与归档策略、证据回溯

3、熟悉 向量数据库、图数据库、PostgreSQL、Redis、Elasticsearch 中至少两类，理解它们在检索、队列与状态存储中的取舍

4、熟练掌握用户画像、知识图谱、推荐系统、RAG、向量检索或行为分析系统等技术领域

5、熟练掌握异步任务系统：Worker、队列、幂等、租约、重试、超时、分布式锁、任务恢复

6、熟悉 LLM 应用工程：结构化输出、Prompt 版本、质量控制、cost 统计与失败降级

7、精通 Python 异步编程，熟悉 FastAPI / Pydantic / SQLAlchemy / pytest

8、熟悉 OpenTelemetry / Prometheus / Langfuse 等可观测体系

9、5 年以上后端 / 分布式系统 / AI 应用基础设施经验，有生产级复杂后端系统交付经历

加分项

1、mem0、MemGPT、Zep、Letta 或同类 Agent Memory 项目的工程或深度使用经验

2、有 LLM 信息抽取、事实生成、冲突合并、质量评估或人工校正闭环经验

有高吞吐异步 Pipeline、Kafka Consumer、PostgreSQL skip locked / 行锁、任务表幂等设计经验

3、有面向开发者的 API / SDK / CLI / OpenAPI 文档或平台型系统研发经验

有真实用户在用的开源 Memory、RAG 或知识图谱项目

