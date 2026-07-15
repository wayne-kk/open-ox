# open-ox 腾讯云快速部署方案（CVM）

**日期**：2026-07-15  
**依据**：[docs/research/tencent-docker-deploy-speed-20260715.md](../research/tencent-docker-deploy-speed-20260715.md)  
**目标机器**：腾讯云中国区单机 CVM + Docker Compose（现状）  
**优化目标**：日常发版从「数十分钟级」压到「数分钟级」；冷构建可接受更长，但不应每次发生。

**落地状态（代码已合入仓库）**：

| 项 | 状态 | 说明 |
|----|------|------|
| A1 Hub 加速 | ✅ `scripts/server-setup.sh` | 需在服务器再跑一次 setup |
| A2 国内源 | ✅ `Dockerfile` / `Dockerfile.runtime` | |
| A3 构建计时 | ✅ `scripts/deploy-on-server.sh` | |
| B1 runtime 拆分 | ✅ `Dockerfile.runtime` + app `FROM ${RUNTIME_IMAGE}` | |
| B2 TCR | ⏳ 可选 | 设 `OPEN_OX_TCR_REPO` / secrets 后 `build-runtime.sh --push` |
| B3/B4 部署 | ✅ | 缺 runtime 时自动 build；可选 push app 镜像 |

**服务器立刻执行（root / ubuntu）**：

```bash
# 1) Hub 加速（若尚未配置）
sudo OPEN_OX_DEPLOY_USER=ubuntu bash /sharedata/wayne/open-ox/scripts/server-setup.sh
docker info | grep -A5 'Registry Mirrors'

# 2) 同步本仓库最新脚本后，构建 runtime（仅首次 / 换 Playwright·字体时）
cd /sharedata/wayne/open-ox
bash scripts/build-runtime.sh

# 3) 日常发版（或等 CI）
bash scripts/deploy-on-server.sh
```

---

## 0. 一句话目标架构

```
GitHub push
    │
    ▼
CI：rsync 源码/compose/env（轻）
    │
    ▼
同地域构建（生产机 或 专用构建机）
    │  冷层命中本地/TCR base
    │  热层只做 next build + 打 tag
    ▼
镜像：ccr.ccs.tencentyun.com/<ns>/open-ox:<sha>
    │
    ▼
生产：compose pull && up -d --no-build
         + bind-mount /sharedata/.../sites（数据不进镜像）
```

**原则**：跨境拉包只允许发生在「换 base / 换 Playwright / 换 apt」时；日常发版只动应用层，生产机尽量只 pull、不 build。

---

## 1. 时间预算（验收标准）

| 场景 | 目标墙钟 | 允许做什么 | 不允许做什么 |
|------|----------|------------|--------------|
| **日常发版**（只改业务代码） | **≤ 5–8 min** | rsync + `next build` 层 + pull/up | apt、`playwright install`、无缓存拉 Hub |
| **依赖变更**（lockfile / template deps） | **≤ 15 min** | pnpm install（国内源）+ rebuild app | 重新装系统字体/Chromium（除非版本变） |
| **冷构建 / base 重建**（每月或大版本） | **≤ 25 min** | apt + Playwright + 推 TCR base | 当作日常路径 |
| **回滚** | **≤ 2 min** | `compose pull` 旧 tag + `up` | 重新 build |

达不到上表 → 先查 §5 诊断清单，不要盲目加机器。

---

## 2. 分层：什么进镜像、什么留宿主机

| 内容 | 放哪 | 变更频率 | 说明 |
|------|------|----------|------|
| Node 运行时、Next standalone、`ai/**`、worker | **应用镜像** `open-ox:<sha>` | 每次发版 | 热层 |
| apt 字体/库、Playwright Chromium、`/ms-playwright` | **base 镜像** `open-ox-runtime:<ver>` | 很少 | 冷层，推 TCR |
| `sites/template` 源文件 | 宿主机 bind-mount（CI rsync） | 中 | 与镜像 seed 解耦 |
| `sites/<projectId>/` 用户站 | **仅宿主机** | 高 | 永不进镜像、永不 `--delete` |
| `.env.production` | 宿主机 | 低 | `NEXT_PUBLIC_*` 变更仍要 rebuild 应用镜像 |

---

## 3. 三阶段落地（按速度杠杆排序）

### Phase A — 当天可做（止血，不改产品形态）

**目标**：保证每次构建走国内路径；冷层尽量命中本地 Docker cache。

#### A1. 宿主机 Docker Hub 内网加速（必做）

```bash
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
sudo systemctl restart docker
docker info | grep -A5 'Registry Mirrors'
# 必须看到 mirror.ccs.tencentyun.com
```

未配置时，`FROM node:20-bookworm-slim` 仍会慢，即使 Dockerfile 已换 apt/npm。

#### A2. 确认 Dockerfile 国内源（已基本落地，发版后抽查日志）

- apt → `mirrors.cloud.tencent.com`（含 `.sources`）
- npm/pnpm → `registry.npmmirror.com`
- Playwright → `PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright`

构建日志**禁止**再出现长时间 `Get: http://deb.debian.org/...`。

#### A3. 部署脚本打阶段计时

在 `scripts/deploy-on-server.sh` 对 `compose build` 前后打戳，便于对照 §1 预算：

```bash
echo "==> build start $(date -Is)"
docker compose -f compose.prod.yaml --env-file .env.production build
echo "==> build end   $(date -Is)"
```

后续可再拆：base pull / apt / pnpm / playwright / next build（用 `DOCKER_BUILDKIT=1` + progress plain 观察）。

#### A4. 纪律：禁止无必要 `--no-cache`

除非在修坏掉的层缓存；日常发版永远增量 build。

**Phase A 验收**：同一台机连续两次只改一个 TS 文件发版，第二次不应再跑 apt / playwright 下载。

---

### Phase B — 本周（结构加速，日常发版真正变快）

**目标**：把 apt + Chromium 从「每次 Dockerfile 变动也可能重跑」变成「显式版本化的 base 镜像」。

#### B1. 拆两层镜像

| 镜像 | 内容 | 标签约定 |
|------|------|----------|
| `open-ox-runtime` | bookworm-slim + 国内源 + apt 字体/库 + Playwright Chromium + pnpm | `2026.07` 或 `pw-1.xx-cjk1` |
| `open-ox` | `FROM open-ox-runtime` → deps/builder/runner 应用拷贝 | git sha / `main-<sha7>` |

建议新增 `Dockerfile.runtime`（或 Dockerfile 多 target `runtime`），由运维**手动/月更**构建并推送：

```text
ccr.ccs.tencentyun.com/<namespace>/open-ox-runtime:2026.07
```

应用 `Dockerfile` 首行改为：

```dockerfile
ARG RUNTIME_IMAGE=ccr.ccs.tencentyun.com/<namespace>/open-ox-runtime:2026.07
FROM ${RUNTIME_IMAGE} AS base
# 不再在日常路径里 apt-get / playwright install
```

#### B2. 开通腾讯云 TCR（个人版即可起步）

- 地域：与 CVM **同地域优先**（个人版大陆常见限制：广州等，以控制台为准）。
- 仓库：`open-ox`、`open-ox-runtime`。
- 生产机：`docker login ccr.ccs.tencentyun.com`。

#### B3. 日常发版流程改为「build app → push → up」

**仍可在生产机构建**（保留本机 BuildKit 缓存），但必须：

1. `docker compose build` 产出 `open-ox:$SHA`
2. `docker tag` + `docker push` 到 TCR（回滚源）
3. `docker compose up -d --no-build`

回滚：

```bash
export OPEN_OX_IMAGE_TAG=<旧sha>
docker compose -f compose.prod.yaml --env-file .env.production pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --no-build
```

#### B4. CI 调整（最小改动）

保持 rsync 源码；SSH 脚本改为：

1. `docker pull` runtime base（若本地无）
2. `compose build`（只热层）
3. `docker push` 应用镜像到 TCR
4. `compose up -d --no-build`

`command_timeout` 可从 60m 降到 **15m**（达标后）。

**Phase B 验收**：改业务代码发版 ≤ 8 min；改 `Dockerfile.runtime` 才触发长构建。

---

### Phase C — 中期（生产机几乎不 build）

**目标**：生产 CVM 只负责跑容器 + 挂载 `sites`；构建挪到同地域构建机或 CI runner。

#### C1. 同地域构建机（推荐）或云主机 CI

- 一台小规格「build」CVM（同 VPC）：装 Docker、Hub 加速、国内源、TCR 登录。
- CI：SSH/自建 runner 在构建机 `build + push`。
- 生产机：**只** `pull + up`，不再 `compose build`。

#### C2. compose 生产默认无 build

```yaml
services:
  open-ox:
    image: ccr.ccs.tencentyun.com/<ns>/open-ox:${OPEN_OX_IMAGE_TAG}
    # build: 仅保留在 compose.build.yaml 给构建机用
```

生产 `deploy-on-server.sh` 缩成：

```bash
docker compose -f compose.prod.yaml --env-file .env.production pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --remove-orphans
```

#### C3. 可选：独立构建机 + COS 中转

仅当构建不在腾讯云内网、产物巨大时：build → `docker save` → 上传同地域 COS → 生产 `docker load`。优先仍用 TCR push/pull。

#### C4. 明确不做

| 方案 | 原因 |
|------|------|
| 主站迁 SCF | `/tmp`、超时、只读根、冷启动；与长驻 Playwright + sites 树冲突 |
| 继续推 GHCR 再让国内机 pull | 已踩坑：跨境大镜像导致 SSH/部署超时 |
| 无加速直连 Docker Hub / deb.debian.org | 单包分钟级，不可作默认路径 |
| 日常发版 `--no-cache` | 主动毁掉 Phase A/B 收益 |

**Phase C 验收**：生产机部署脚本无 `build`；发版 ≤ 5 min（含 rsync template + pull + 健康检查）。

---

## 4. 目标目录与职责（落地后）

```
/sharedata/wayne/open-ox/
├── compose.prod.yaml          # 生产：只声明 TCR image + volumes + env
├── compose.build.yaml         # 可选：构建机用，含 build.args
├── .env.production
├── sites/                     # 唯一写密集数据面（bind-mount）
│   ├── template/              # CI rsync
│   └── <projectId>/
├── scripts/
│   ├── deploy-on-server.sh    # pull + up（Phase C）或 build+push+up（Phase B）
│   ├── build-runtime.sh       # 月更：构建并推 open-ox-runtime
│   └── docker-entrypoint.sh
└── logs/
```

镜像仓库（TCR）：

```
ccr.ccs.tencentyun.com/<ns>/open-ox-runtime:2026.07
ccr.ccs.tencentyun.com/<ns>/open-ox:<git-sha>
ccr.ccs.tencentyun.com/<ns>/open-ox:main   # 可选浮动标签，仅指向当前生产
```

---

## 5. 诊断清单（慢的时候按序查）

1. `docker info | grep -A5 Registry` → 有无 `mirror.ccs.tencentyun.com`
2. 本次 build 日志是否出现 `deb.debian.org` / `registry.npmjs.org` / `cdn.playwright.dev`
3. 是否误改了 `Dockerfile` 里 apt/browsers 层，导致冷层全失效
4. 是否 `COPY . .` 提前到了 `pnpm install` / `playwright install` 之前
5. 生产是否在跑完整 `next build` 而本可 pull TCR 已有 tag
6. rsync 是否把 `node_modules` / `.next` / `docs` / `.scratch` 又同步进去（应继续排除）
7. 磁盘是否写满导致 BuildKit 重建异常慢（`df -h`）

---

## 6. 实施顺序（建议排期）

| 日序 | 事项 | 负责人 | 完成定义 |
|------|------|--------|----------|
| D0 | A1 Hub 加速 + A2 日志抽查 + A3 计时 | 运维 | `docker info` 有加速器；二次发版无 apt |
| D1–D2 | 开通 TCR；写 `Dockerfile.runtime` + `build-runtime.sh` | 研发+运维 | runtime 镜像可 pull |
| D3–D4 | 应用 Dockerfile `FROM` runtime；CI push 应用镜像 | 研发 | 日常发版 ≤ 8 min |
| D5+ | 生产改为 pull-only（Phase C）；构建机或 CI 同地域 build | 运维 | 生产脚本无 build；回滚 ≤ 2 min |

---

## 7. 与现状对照

| 现状 | 本方案 |
|------|--------|
| 每次在生产机 `compose build` 全镜像 | 日常只热层；最终生产只 pull |
| 怕 GHCR 慢所以本机构建（正确止血） | 保留「国内构建」，制品改落 **同地域 TCR** |
| apt/npm/PW 已换国内源 | 保留；再加 Hub 加速 + runtime 固化 |
| `sites` bind-mount | **不变**（正确） |
| root 跑容器 | 可保留（单机）；与速度无关 |
| CI rsync 整仓上下文 | 继续收紧 exclude；镜像不靠 rsync 传 |

---

## 8. 成功后的体感

- **点一次 main 合并**：约 5–8 分钟看到健康检查绿（Phase B），Phase C 后更短。
- **回滚**：改 tag + pull + up，约 1–2 分钟。
- **升 Playwright / 加字体**：跑一次 `build-runtime.sh`，约 15–25 分钟，与日常发版解耦。

调研细节与一手链接见 [tencent-docker-deploy-speed-20260715.md](../research/tencent-docker-deploy-speed-20260715.md)。本方案是执行版；落地时改 Dockerfile/CI 另开变更，勿与调研文混提。
