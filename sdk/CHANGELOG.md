# Changelog

## 0.1.0 (2026-04-14)

Initial release.

- `OpenOxClient` — 核心客户端，支持 `generateProject()` 和 `modifyProject()`
- `@open-ox/sdk/server` — Node.js 适配器（FileSystem、ShellExecutor、PromptLoader）
- `createHttpServer()` — 内置 HTTP API 服务器，SSE 流式推送
- 可替换适配器接口（FileSystem、ShellExecutor、PromptLoader）
- 完整 TypeScript 类型导出
- Python 客户端示例
