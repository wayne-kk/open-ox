# Requirements Document

## Introduction

本功能将 open-ox AI 网站生成系统从单一覆盖式工作目录（`sites/template`）升级为支持多项目持久化管理的系统。每次 AI 生成的网站将作为独立"项目"保存在 `sites/{project-id}/` 下，用户可以查看历史项目列表、重新打开预览，并对已有项目进行 AI 辅助修改。项目元数据通过本地 JSON 文件持久化，不强依赖外部数据库。

## Glossary

- **Project_Manager**: 负责项目元数据 CRUD 操作的服务模块
- **Project**: 一次 AI 生成的网站实例，包含代码文件和元数据
- **Project_ID**: 项目的唯一标识符，格式为 `{timestamp}-{slug}`，例如 `2026-03-26T13-32-39_my-shop`
- **Project_Metadata**: 描述项目的 JSON 数据，包含 id、name、createdAt、updatedAt、status、userPrompt、blueprint 摘要等字段
- **Project_Registry**: 存储所有项目元数据的 JSON 文件，路径为 `.open-ox/projects.json`
- **SITE_ROOT**: 环境变量，指向当前生成目标目录，动态设置为 `sites/{project-id}`
- **Project_Dir**: 某个项目的代码目录，路径为 `sites/{project-id}/`
- **Dev_Server**: 为某个项目启动的 Next.js 开发服务器进程
- **Preview_URL**: 项目预览地址，格式为 `http://localhost:{port}`
- **Port_Allocator**: 负责为项目分配可用端口的模块
- **Build_Studio**: 前端页面 `app/build-studio/page.tsx`，用户在此输入需求并触发生成
- **Project_Dashboard**: 展示所有历史项目列表的前端页面
- **Modify_Flow**: 对已有项目执行 AI 辅助修改的流程，区别于全量生成的 Generate_Flow
- **Generate_Flow**: 现有的 `runGenerateProject` 全量生成流程
- **Template_Dir**: `sites/template/`，作为新项目的初始文件来源（复制模板）
- **Workspace_Root**: monorepo 根目录，包含 `pnpm-workspace.yaml` 和根级 `package.json`
- **Workspace_Root_Package**: 根目录 `package.json` 中声明的依赖，作为所有 workspace 包共享的基础依赖（next、react、radix-ui、tailwindcss 等）
- **Project_Package**: 某个 Project_Dir 下的 `package.json`，仅声明该项目特有的额外依赖，不重复声明 Workspace_Root_Package 中已有的包
- **Shared_Dependencies**: 在 Workspace_Root_Package 中声明、由 pnpm workspace 提升到根目录 `node_modules` 的依赖，所有 `sites/*` 项目均可直接使用
- **Project_Specific_Dependencies**: AI 生成时识别出的、不在 Shared_Dependencies 中的额外包，仅安装在对应 Project_Package 中


## Requirements

### Requirement 1: 项目创建与持久化

**User Story:** 作为用户，我希望每次 AI 生成的网站都作为独立项目保存，而不是覆盖上一次的结果，这样我可以保留所有历史生成记录。

#### Acceptance Criteria

1. WHEN 用户通过 `POST /api/ai` 触发生成时，THE Project_Manager SHALL 在生成开始前创建一个新的 Project，分配唯一的 Project_ID，并在 Project_Registry 中写入初始元数据（status: "generating"）
2. WHEN 生成流程启动时，THE Generate_Flow SHALL 将代码写入 `sites/{project-id}/` 目录，而非固定的 `sites/template/` 目录
3. WHEN 新项目目录创建时，THE Project_Manager SHALL 将 Template_Dir 中的基础框架文件（package.json、tsconfig.json、next.config.js 等）复制到 Project_Dir，并通过 pnpm workspace 共享基础依赖，以确保项目可独立运行
4. WHEN 生成流程成功完成时，THE Project_Manager SHALL 将 Project_Registry 中对应项目的 status 更新为 "ready"，并记录 completedAt 时间戳
5. IF 生成流程发生错误，THEN THE Project_Manager SHALL 将对应项目的 status 更新为 "failed"，并记录 error 信息
6. THE Project_Registry SHALL 以 JSON 文件形式持久化存储在 `.open-ox/projects.json`，每个项目条目包含 id、name、userPrompt、status、createdAt、updatedAt、completedAt、verificationStatus 字段
7. THE Generate_Flow SHALL 不再在生成前调用 `clearTemplate()`，而是直接写入新的 Project_Dir

---

### Requirement 2: 项目列表查看

**User Story:** 作为用户，我希望能在 Project_Dashboard 页面查看所有历史生成的项目，以便了解我的生成记录并选择要操作的项目。

#### Acceptance Criteria

1. THE Project_Dashboard SHALL 通过 `GET /api/projects` 接口获取所有项目列表，按 createdAt 降序排列
2. WHEN Project_Dashboard 加载时，THE Project_Dashboard SHALL 展示每个项目的 name、userPrompt 摘要（前 100 字符）、status、createdAt 和 verificationStatus
3. WHILE status 为 "generating" 时，THE Project_Dashboard SHALL 以轮询方式（间隔不超过 3 秒）刷新该项目的状态，直到 status 变为 "ready" 或 "failed"
4. THE Project_Dashboard SHALL 对 status 为 "ready"、"generating"、"failed" 的项目分别展示不同的视觉状态标识
5. IF Project_Registry 文件不存在，THEN THE `GET /api/projects` 接口 SHALL 返回空数组而非错误

---

### Requirement 3: 重新打开与预览项目

**User Story:** 作为用户，我希望能重新打开某个历史项目并预览其网站，以便查看之前生成的结果。

#### Acceptance Criteria

1. WHEN 用户在 Project_Dashboard 点击某个 status 为 "ready" 的项目时，THE Project_Dashboard SHALL 导航到该项目的详情页 `/projects/{project-id}`
2. WHEN 项目详情页加载时，THE Dev_Server SHALL 通过 `POST /api/projects/{project-id}/preview` 接口为该项目启动一个独立的 Next.js dev server 进程
3. WHEN Dev_Server 启动时，THE Port_Allocator SHALL 从 3100 开始扫描，分配第一个未被占用的端口给该项目
4. WHEN Dev_Server 成功启动后，THE 项目详情页 SHALL 在 iframe 中展示 Preview_URL（`http://localhost:{port}`）
5. IF 该项目的 Dev_Server 已在运行，THEN THE `POST /api/projects/{project-id}/preview` 接口 SHALL 直接返回已有的 Preview_URL，不重复启动
6. WHEN 用户离开项目详情页时，THE Dev_Server SHALL 保持运行，直到用户通过 `DELETE /api/projects/{project-id}/preview` 显式停止，或主应用进程退出
7. THE `GET /api/projects/{project-id}/preview/status` 接口 SHALL 返回该项目 Dev_Server 的运行状态（running/stopped）和 Preview_URL

---

### Requirement 4: AI 辅助修改已有项目

**User Story:** 作为用户，我希望能对已有项目进行 AI 辅助修改，而不必重新生成整个网站，以便快速迭代调整。

#### Acceptance Criteria

1. WHEN 用户在项目详情页提交修改请求时，THE `POST /api/projects/{project-id}/modify` 接口 SHALL 接收 userInstruction 字符串并触发 Modify_Flow
2. WHEN Modify_Flow 启动时，THE Modify_Flow SHALL 读取该项目现有的代码文件和 blueprint 元数据作为上下文
3. WHEN Modify_Flow 执行时，THE Modify_Flow SHALL 仅修改与用户指令相关的文件，不重新生成整个项目
4. WHEN Modify_Flow 完成时，THE Project_Manager SHALL 将 Project_Registry 中对应项目的 updatedAt 更新为当前时间戳，并追加修改记录到 modificationHistory 数组
5. IF Modify_Flow 修改了文件，THEN THE Dev_Server SHALL 通过 Next.js HMR 自动热更新预览，无需重启
6. THE Modify_Flow SHALL 通过 SSE 流式推送修改步骤进度，格式与 Generate_Flow 的 SSE 格式保持一致

---

### Requirement 5: 项目元数据管理

**User Story:** 作为用户，我希望能对项目进行基本的元数据管理（重命名、删除），以便整理我的项目列表。

#### Acceptance Criteria

1. WHEN 用户通过 `PATCH /api/projects/{project-id}` 提交 name 字段时，THE Project_Manager SHALL 更新 Project_Registry 中对应项目的 name 和 updatedAt
2. WHEN 用户通过 `DELETE /api/projects/{project-id}` 删除项目时，THE Project_Manager SHALL 从 Project_Registry 中移除该项目条目，并删除对应的 Project_Dir
3. IF 被删除项目的 Dev_Server 正在运行，THEN THE Project_Manager SHALL 在删除 Project_Dir 前先停止该 Dev_Server 进程
4. THE `GET /api/projects/{project-id}` 接口 SHALL 返回单个项目的完整元数据，包含 modificationHistory
5. IF 请求的 project-id 不存在于 Project_Registry，THEN THE 相关 API 接口 SHALL 返回 HTTP 404 状态码

---

### Requirement 6: 向后兼容与配置

**User Story:** 作为开发者，我希望新的多项目系统能与现有的 `SITE_ROOT` 环境变量机制兼容，以便在不破坏现有部署的情况下平滑升级。

#### Acceptance Criteria

1. WHEN `SITE_ROOT` 环境变量被显式设置时，THE Generate_Flow SHALL 优先使用该环境变量指定的目录，忽略动态 Project_Dir 逻辑（单项目兼容模式）
2. WHERE 多项目模式启用（`SITE_ROOT` 未设置或设置为 `sites/`），THE Project_Manager SHALL 使用 `sites/{project-id}/` 作为每个项目的 Project_Dir
3. THE `ai/tools/system/common.ts` 中的 `SITE_ROOT` 导出 SHALL 在运行时可被动态覆盖，以支持每次生成使用不同的目标目录
4. THE Project_Manager SHALL 提供 `getSiteRoot(projectId: string): string` 函数，返回指定项目的绝对路径

---

### Requirement 7: 项目初始化（模板复制）

**User Story:** 作为系统，我希望每个新项目都从 Template_Dir 复制基础框架，并通过 pnpm workspace 共享基础依赖，以确保每个项目都是独立可运行的 Next.js 应用，同时避免重复安装几百 MB 的 node_modules。

#### Acceptance Criteria

1. WHEN 新项目创建时，THE Project_Manager SHALL 将 Template_Dir 中除生成文件（`components/sections/`、`app/page.tsx`、`app/layout.tsx`、`app/globals.css`、`design-system.md`）之外的所有文件复制到 Project_Dir
2. WHEN 模板复制完成后，THE Project_Manager SHALL 将 Project_Dir 中的 `package.json` 的 `name` 字段更新为该项目的 Project_ID，并移除所有已在 Workspace_Root_Package 中声明的 Shared_Dependencies，仅保留 Project_Specific_Dependencies
3. WHEN Generate_Flow 识别出需要 Project_Specific_Dependencies 时，THE Project_Manager SHALL 仅在 Project_Dir 的 `package.json` 中添加这些额外依赖，并在 Project_Dir 内执行 `pnpm install` 安装
4. WHEN 项目初始化完成且无 Project_Specific_Dependencies 时，THE Project_Manager SHALL 不在 Project_Dir 内执行 `pnpm install`，直接依赖 workspace 根目录的 Shared_Dependencies
5. IF Template_Dir 不存在或复制失败，THEN THE Project_Manager SHALL 返回错误并将项目 status 设置为 "failed"
6. THE Project_Manager SHALL 在复制完成后验证 Project_Dir 中存在 `package.json` 和 `next.config.js`，否则视为初始化失败

---

### Requirement 8: pnpm Workspace 依赖管理

**User Story:** 作为开发者，我希望所有生成的项目通过 pnpm workspace monorepo 共享基础包，避免每个项目重复安装几百 MB 的 node_modules，同时允许各项目按需安装特有依赖。

#### Acceptance Criteria

1. THE Workspace_Root SHALL 在 `pnpm-workspace.yaml` 中将 `sites/*` 声明为 workspace packages，使所有生成项目纳入 monorepo 管理
2. THE Workspace_Root_Package SHALL 在根目录 `package.json` 中声明所有 Template_Dir 使用的基础依赖（next、react、react-dom、radix-ui、tailwindcss、framer-motion、lucide-react、clsx、tailwind-merge 等）作为 Shared_Dependencies
3. WHEN 新项目的 Project_Package 中不包含 Project_Specific_Dependencies 时，THE Project_Manager SHALL 确保该项目直接使用 workspace 根目录提升的 Shared_Dependencies，无需在 Project_Dir 内单独安装
4. WHEN AI 生成流程（Generate_Flow 或 Modify_Flow）需要安装 Project_Specific_Dependencies 时，THE installPackageTool SHALL 在 Project_Dir 内执行 `pnpm add {package}` 而非在根目录执行，确保特有依赖仅写入 Project_Package
5. IF 某个 Project_Specific_Dependencies 与 Shared_Dependencies 中已有的包版本冲突，THEN THE Project_Manager SHALL 在 Project_Package 中显式声明该包的所需版本，由 pnpm workspace 的版本覆盖机制处理
6. THE `pnpm-workspace.yaml` SHALL 保留现有的 `ignoredBuiltDependencies` 配置（sharp、unrs-resolver），不影响现有构建行为
7. WHEN 在 Workspace_Root 执行 `pnpm install` 时，THE pnpm workspace SHALL 将所有 Shared_Dependencies 提升到根目录 `node_modules`，所有 `sites/*` 项目均可通过 Node.js 模块解析访问这些依赖

