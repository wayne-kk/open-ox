# 调研：腾讯云中国区 VPS 上 Docker 部署为何慢，以及主流加速策略（2026-07-15）

> **归档**：生产已切到 PM2（见 `docs/deploy/tencent-cvm-fast-path.md`）。下文仅作历史调研，仓库内 Docker 配置已移除。

**状态**：完成（第一方公开材料：腾讯云官方文档、Docker / BuildKit 文档、Debian 镜像站帮助、Playwright 官方文档、npmmirror / cnpm 站点、Next.js 官方 docs）  
**日期**：2026-07-15  
**问题**：为何在腾讯云中国区 CVM / 轻量应用服务器上做 Docker 构建与部署会很慢？腾讯云官方与主流生态推荐哪些高效部署路径？对 open-ox（Next.js standalone + Playwright Chromium + apt 字体/库、CI rsync 后在服务器 `docker compose build`）有哪些可执行建议？

**一句话摘要**：中国区 VPS 的瓶颈几乎总是**跨境拉包/拉镜像**（Docker Hub、`deb.debian.org`、npm registry、Playwright CDN、GitHub/GHCR），而不是 Docker 引擎本身；腾讯云官方路径是 **同地域 TCR 托管制品 + 内网镜像加速 + `mirrors.cloud.tencent.com` / npm / Docker CE 源**，再配合 BuildKit 分层缓存，把「每次部署都 apt/Playwright」从关键路径拿掉。open-ox 已切国内源、已在服务器本地构建（避开 GHCR），下一步高杠杆是 **把冷层（base/apt/browsers）锁死为可复用镜像或 TCR 制品，并保证 daemon 使用腾讯云内网 Docker Hub 加速器**。

**范围说明**：

1. 面向 **单机 CVM + Docker Compose**（open-ox 现状）与官方容器产品（TCR / TKE / SCF）的务实对照，不是全云原生选型白皮书。
2. 只陈述一手来源能支撑的事实；跨境延迟的具体毫秒数因线路而异，本文用官方「会慢 / 建议换源」表述，不臆造测速数字。
3. **不修改** Dockerfile / 应用代码；本文仅调研与建议。

**Open-OX 对照基线**：

- 生产在腾讯云服务器上 `docker compose build`（刻意不从 `ghcr.io` 拉大镜像；见 `compose.prod.yaml` / `scripts/deploy-on-server.sh` 注释）。
- CI：rsync 构建上下文 → SSH 跑 `deploy-on-server.sh`。
- 镜像：`node:20-bookworm-slim` + pnpm + Playwright Chromium + runner 阶段 apt 字体/库；已默认 `DEBIAN_MIRROR=mirrors.cloud.tencent.com`、`NPM_REGISTRY=https://registry.npmmirror.com`、`PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright`。
- 近期痛点：未换源时 `apt-get` 自 `deb.debian.org` 单包间隔可达数分钟级（运维日志观察；与官方「官方源在国内慢」叙事一致）。

---

## 1. 为何中国区 VPS 上 Docker 构建慢

### 1.1 网络：多次跨境拉取叠加

一次「干净」构建会触达多条境外链路；任一环节慢都会把总时间拉到数十分钟。

| 依赖 | 默认上游 | 中国区常见问题 | 一手来源 |
|------|----------|----------------|----------|
| 基础镜像 / 工具镜像 | Docker Hub (`docker.io`) | 官方文档明确：未配置加速时从 Docker Hub 拉取「通常下载速度会比较慢」；`docker pull` 超时常见，建议换腾讯云镜像源 | [轻量：安装 Docker 并配置镜像加速源](https://cloud.tencent.com/document/product/1207/45596)；[CVM：搭建 Docker](https://cloud.tencent.com/document/product/213/46000)（超时说明指向换源） |
| apt 包 | `deb.debian.org` / `security.debian.org` | 腾讯云为「软件依赖安装时官方源访问速度慢」提供镜像站；Debian 12+ 源格式为 DEB822（`debian.sources`），换源需覆盖 `.sources` / `.list` | [腾讯云软件源加速](https://cloud.tencent.com/document/product/213/8623)；[Debian 源帮助（mirrors.cloud.tencent.com）](https://mirrors.cloud.tencent.com/help/debian.html) |
| npm / pnpm | `registry.npmjs.org` | 腾讯云提供 NPM 镜像；社区主站 npmmirror 声明为完整 npmjs 只读镜像 | [腾讯云软件源 · NPM](https://cloud.tencent.com/document/product/213/8623)；[npmmirror 使用说明](https://web.npmmirror.com/) |
| Playwright 浏览器 | Microsoft CDN（`cdn.playwright.dev` 等） | 官方：默认从 Microsoft CDN 下载；可用 `PLAYWRIGHT_DOWNLOAD_HOST` 指向自建或第三方制品库 | [Playwright: Browsers · Download from artifact repository](https://playwright.dev/docs/browsers) |
| 远程制品 / 源码附属 | GHCR、GitHub Releases、raw.githubusercontent.com | 腾讯云 CVM 文档：推送 Docker Hub 需能访问 hub；否则超时，建议推到 TCR 等其他仓库 | [CVM：搭建 Docker · 推送镜像](https://cloud.tencent.com/document/product/213/46000) |
| 境外开源镜像平台 | Docker Hub、`quay.io` 等 | TKE 文档：国内拉取可能慢甚至失败；TCR 企业版提供境外镜像加速（仅 VPC 内网生效） | [TKE：境外镜像拉取加速](https://cloud.tencent.com/document/product/457/51237) |

**对 open-ox**：注释与 CI 已记录「Tencent → ghcr.io 过慢导致 SSH 超时」；因此改为**在服务器构建**是合理规避，但构建时仍会拉 `node:20-bookworm-slim`、apt、npm、Playwright——若 daemon / Dockerfile 未全部走国内路径，慢点只是搬家，不是消失。

### 1.2 层缓存未命中：昂贵步骤被反复执行

Docker BuildKit 规则（一手）：

- 某层指令或依赖文件变化 → **该层及之后所有层失效**，必须重跑。
- `COPY` / `ADD` 按文件内容元数据校验；应把**少变步骤放前、常变步骤放后**。
- `RUN --mount=type=cache` 可在层失效后仍复用包管理器下载缓存。
- 外部 cache（`--cache-from` / `--cache-to` registry）适合 ephemeral CI builder。

来源：[Docker: How the build cache works](https://docs.docker.com/build/cache)；[Build cache invalidation](https://docs.docker.com/build/cache/invalidation/)；[Optimize cache usage](https://docs.docker.com/build/cache/optimize/)。

**典型中国区放大效应**：

1. **apt 层失效**（改 `RUN apt-get`、换 base 小版本、误把常变文件拷进 apt 之前）→ 再次从源站拉数十个 deb；若仍指向 `deb.debian.org`，日志可出现「每包数分钟」级间隔（与 open-ox 近期观察一致）。
2. **Playwright `install` 层失效**（lockfile / playwright 版本变，或错误地把 `COPY . .` 放在 install 之前）→ 再下数百 MB Chromium。
3. **pnpm install 层失效**（`package.json` / lockfile 变）→ 即使有 npmmirror，仍有 CPU 解压与网络；BuildKit cache mount 可缓解重复下载。

open-ox 当前分层（`deps` → `browsers` → `builder` → `runner` apt）与 Docker/Next 最佳实践方向一致；**冷路径慢**仍主要来自「首次 / 无缓存 / 源未加速」而非分层设计错误。

### 1.3 「在服务器构建」vs「别处构建再拉取」

| 模式 | 优点 | 缺点 | 一手依据 |
|------|------|------|----------|
| **CI 构建 → 推 registry → 服务器 pull** | 构建 CPU/内存可独立扩；服务器只拉取与启动 | 镜像大（含 Playwright）时，**跨太平洋 / 跨 GHCR** 拉取极慢；需同地域 registry | TCR 强调就近拉取、多地域复制；CVM 文档建议慢时推 TCR 而非 Hub |
| **服务器本地 build**（open-ox 现状） | 层缓存在本机；避免 GHCR 大镜像跨境 pull | 占用生产机 CPU/磁盘；每次仍可能拉 base + apt + npm + browsers | `deploy-on-server.sh` 注释；Docker 本地 cache 行为见上 |
| **同地域 TCR：CI 或构建机 push，CVM pull** | 制品在腾讯云内网/同地域；生产机只 `pull` + `up` | 需开通 TCR；个人版有配额且大陆仅广州等限制 | [TCR 产品概述](https://cloud.tencent.com/document/product/1141/39278)；[个人版快速入门](https://cloud.tencent.com/document/product/1141/63910) |

**结论**：open-ox 从 GHCR pull 改为本地 build 是正确止血；**长期更快**的主流做法是「在能快速访问国内源的机器上 build 一次 → 推到**同地域 TCR** → CVM 只拉本地 registry」。

---

## 2. 腾讯云官方主流部署策略

### 2.1 策略地图（官方产品）

| 策略 | 适用 | 官方要点 | 来源 |
|------|------|----------|------|
| **CVM / 轻量 + Docker Compose** | 单机、有状态目录（如 bind-mount sites） | 安装 Docker CE（可用 `mirrors.cloud.tencent.com` 的 docker-ce 源）；配置 `registry-mirrors`；在机器上 build/run | [搭建 Docker](https://cloud.tencent.com/document/product/213/46000)；[轻量 Docker 加速](https://cloud.tencent.com/document/product/1207/45596) |
| **TCR（个人版 / 企业版）** | 托管镜像制品 | 个人版免费限额、共享后端、不承诺 SLA；企业版独享、内网访问、多地域复制、P2P/按需加载等；制品底层可落 COS | [产品概述](https://cloud.tencent.com/document/product/1141/39278)；[计费概述（含 COS）](https://cloud.tencent.com/document/product/1141/40540)；[个人版快速入门](https://cloud.tencent.com/document/product/1141/63910) |
| **TKE + TCR** | K8s 编排、多副本 | 同地域建议内网拉 TCR；可装 TCR 插件免密；Docker Hub 等可走加速域名 | [TKE 用 TCR 插件内网免密拉取](https://cloud.tencent.com/document/product/1141/48184)；[境外镜像拉取加速](https://cloud.tencent.com/document/product/457/51237) |
| **SCF / Serverless** | 短时、无状态函数 | 内存默认上限 3072MB、`/tmp` 512MB、超时默认最大 900s；镜像冷启动有 InitTimeout；**不适合**长驻 Playwright + 大 bind-mount 站点树 | [配额限制](https://cloud.tencent.com/document/product/583/11637)；[函数概述 · 超时](https://cloud.tencent.com/document/product/583/19805) |
| **COS** | 大文件 / 构建产物 / 静态资源 | 大文件建议先上 COS 再由计算侧拉取；TCR 企业版存储与公网流量按 COS 计费；TKE 可挂 COS CSI | [SCF 配额 · 大文件走 COS](https://cloud.tencent.com/document/product/583/11637)；[TCR 计费](https://cloud.tencent.com/document/product/1141/40540)；[TKE 使用 COS](https://cloud.tencent.com/document/product/457/44232) |
| **CODING DevOps 制品库** | CI 制品（含 Docker） | 腾讯云 CODING 提供 Docker 等制品库快速开始 | [CODING 制品库快速开始](https://cloud.tencent.com/document/product/1726/97072) |

### 2.2 镜像与软件源加速（官方地址）

**Docker Hub 加速（腾讯云内网）**

- 地址：`https://mirror.ccs.tencentyun.com`
- **仅内网**；不支持外网域名加速。
- 配置：`/etc/docker/daemon.json` → `"registry-mirrors": ["https://mirror.ccs.tencentyun.com"]`，然后 `systemctl restart docker`。
- TKE 节点创建时会自动配置腾讯云内网镜像。

来源：[软件源加速 · Docker](https://cloud.tencent.com/document/product/213/8623)；[轻量应用服务器实践](https://cloud.tencent.com/document/product/1207/45596)。

Docker 上游对 mirror 的通用机制：daemon `registry-mirrors`；Hub 可被 pull-through cache 镜像。来源：[Docker Docs: Mirror the Docker Hub library](https://docs.docker.com/docker-hub/image-library/mirror/)。

**Debian / 通用软件源**

- 统一域名：`mirrors.cloud.tencent.com`（公网可用；VPC 内默认 DNS 可解析到内网链路，更稳且省公网流量）。
- 另有：`mirrors.tencent.com`（公网）、`mirrors.tencentyun.com`（内网）。
- 文档说明：源站**每天从官网同步一次**。
- Debian 帮助页给出 bookworm 等版本的传统 sources.list 与 DEB822 模板。

来源：[腾讯云软件源加速](https://cloud.tencent.com/document/product/213/8623)；[Debian 帮助](https://mirrors.cloud.tencent.com/help/debian.html)。

**NPM（腾讯云）**

```bash
npm config set registry https://mirrors.tencent.com/npm/
```

来源：[同上 · NPM](https://cloud.tencent.com/document/product/213/8623)。

**npmmirror（阿里云赞助的中国 npm 镜像，cnpm 生态）**

```bash
npm config set registry https://registry.npmmirror.com
```

另提供 Node dist、以及 binaries 镜像站（含 Playwright 等路径，社区广泛用于 `PLAYWRIGHT_DOWNLOAD_HOST`）。站点声明为完整 npmjs 只读镜像，代码开源为 cnpmcore。

来源：[npmmirror 使用说明](https://web.npmmirror.com/)；[cnpm/cnpmcore README](https://github.com/cnpm/cnpmcore)（标明 npmmirror.com 由阿里云赞助）。

**Playwright**

```bash
PLAYWRIGHT_DOWNLOAD_HOST=<host> npx playwright install
```

官方意图侧重「公司内部制品库 / 透明代理」；第三方镜像布局需自行保证与 Playwright 期望路径兼容（社区常用 npmmirror binaries）。来源：[Playwright Browsers](https://playwright.dev/docs/browsers)。

**Docker CE 安装包本身**也可用腾讯云镜像（`mirrors.cloud.tencent.com/docker-ce/...`），避免从 `download.docker.com` 装引擎时就慢。来源：[搭建 Docker](https://cloud.tencent.com/document/product/213/46000)。

### 2.3 TCR 推送/拉取（个人版示例）

个人版登录与仓库域名示例（广州等）：

```bash
docker login ccr.ccs.tencentyun.com --username=<腾讯云账号ID>
docker tag nginx:latest ccr.ccs.tencentyun.com/<namespace>/nginx:latest
docker push ccr.ccs.tencentyun.com/<namespace>/nginx:latest
docker pull ccr.ccs.tencentyun.com/<namespace>/nginx:latest
```

注意：个人版在中国大陆**仅在广州部署**等地域限制；命名空间全局不可重复；免费限额、共享存储。企业版实例域名形如 `<instance>.tencentcloudcr.com`，支持 VPC 内网与多地域复制。

来源：[个人版快速入门](https://cloud.tencent.com/document/product/1141/63910)；[同实例多地域复制](https://cloud.tencent.com/document/product/1141/52095)；[产品服务层级](https://cloud.tencent.com/document/product/1141/104731)。

---

## 3. 缩短部署时间的具体模式

按「杠杆 × 官方可落地性」排列。

### 3.1 同地域预构建镜像（TCR）+ 生产机只 pull

- CI / 专用构建机（同样在腾讯云国内、已配国内源）执行 `docker build` → `docker push` 到 TCR。
- CVM：`docker compose pull && up`（或显式 `image: ccr.ccs.tencentyun.com/...`），**不再在生产机跑 apt/Playwright**。
- 企业版：同 VPC 内网拉、多地域复制就近访问。

来源：TCR 概述与个人版/企业版入门；TKE 同地域内网建议。

### 3.2 宿主机 Docker Hub 加速器必开

即使 Dockerfile 已换 apt/npm，**`FROM node:20-bookworm-slim` 仍走 Docker Hub**（除非改写为 TCR 上的同步副本）。未配 `mirror.ccs.tencentyun.com` 时，冷启动拉 base 仍会慢。

来源：[daemon registry-mirrors](https://cloud.tencent.com/document/product/213/8623)；[Docker Hub mirror 机制](https://docs.docker.com/docker-hub/image-library/mirror/)。

### 3.3 BuildKit：分层顺序 + cache mount + 外部 cache

- 顺序：lockfile → install →（browsers）→ COPY 源码 → build → runner 拷贝制品。
- `RUN --mount=type=cache`：pnpm store、apt `/var/cache/apt`（`sharing=locked`）。
- CI 多机：`--cache-to` / `--cache-from type=registry,ref=...` 把 cache 存 TCR。

来源：[Optimize cache usage](https://docs.docker.com/build/cache/optimize/)。

### 3.4 极少变动的 apt / Playwright 独立层或「基础镜像」

- 将 OS 依赖 + Chromium 打成 `open-ox-runtime-base:YYYYMMDD`，推入 TCR；应用 Dockerfile `FROM` 该 base，日常部署只重建 Next build 层。
- 或保证 `browsers` / `runner` apt 的 cache key **不依赖源码 COPY**（open-ox 已把 browsers 挂在 deps 上）。

来源：Docker 缓存失效规则；Playwright 浏览器体积说明（数百 MB 级）见 [Playwright Browsers](https://playwright.dev/docs/browsers)。

### 3.5 国内源（apt / npm / Playwright）写进镜像构建

- apt：`sed` 替换 `deb.debian.org` → `mirrors.cloud.tencent.com`（含 `.sources`）。
- npm：`registry.npmmirror.com` 或 `mirrors.tencent.com/npm/`。
- Playwright：`PLAYWRIGHT_DOWNLOAD_HOST`。

来源：§2.2 各官方页。

### 3.6 缩小构建上下文 + rsync 增量

- `.dockerignore` 排除 `node_modules`、日志、无关目录（Docker：减小 context、降低无效失效）。
- CI `rsync -az`（open-ox 已用）优于每次整包 tar；仍应避免把巨大无关目录同步进上下文。

来源：[Optimize cache · Keep the context small](https://docs.docker.com/build/cache/optimize/)；open-ox CI workflow。

### 3.7 Remote builder / 构建与运行分离

- 在同地域另一台「构建 CVM」或 TKE Job 上 build+push TCR；生产机只 pull。
- 避免在业务高峰与 `next build`、Playwright 下载抢同一台机的 CPU/磁盘。

（模式组合自 TCR + CVM 官方能力；无单独「remote builder」产品名时，用独立构建机 + TCR 即主流实现。）

### 3.8 Next.js standalone 减小运行镜像

`output: 'standalone'` 只打包运行所需文件，减小最终镜像与拷贝量。来源：[Next.js: output standalone](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)；[with-docker 示例](https://github.com/vercel/next.js/blob/canary/examples/with-docker/README.md)。

**注意**：open-ox 另含 Playwright / sharp / `ai/**` 等，standalone 不能单独消灭浏览器体积；浏览器仍应靠层缓存或 base 镜像。

### 3.9 COS 传大制品（可选）

若构建在境外或产物巨大：先传到同地域 COS，再由国内机下载解压 / `docker load`，避免直连 GitHub。SCF 文档对「>6MB 入参」也推荐 COS 中转。来源：[SCF 配额限制](https://cloud.tencent.com/document/product/583/11637)。

---

## 4. 与 open-ox 相关的权衡（Next.js + Playwright 生产镜像）

| 选项 | 对 open-ox 的含义 | 利 | 弊 |
|------|-------------------|----|----|
| **继续服务器本地 build** | 现状 | 无 GHCR 跨境；层缓存留本机 | 部署时占生产 CPU；冷缓存仍慢；与业务争资源 |
| **TCR 存完整生产镜像** | 推荐演进 | 部署变「pull + up」；可回滚 tag | 需管理仓库与登录；个人版配额/地域限制；镜像仍大（Chromium） |
| **拆 base 镜像（apt+browsers）与 app 镜像** | 高杠杆 | 日常只重建 Next；base 数周一更 | 多一个仓库/标签约定；Playwright 大版本升级要重建 base |
| **迁 TKE** | 多副本时 | 官方内网拉 TCR、滚动发布 | 对单机 bind-mount `sites` 运维更重；成本与复杂度上升 |
| **迁 SCF** | 不推荐作主路径 | 弹性 | `/tmp` 512MB、超时、只读根文件系统、冷启动；**与长驻 Chromium + 站点树冲突** |
| **仅换源、不改架构** | 已做大部分 | 成本低、立刻缓解 apt/npm/PW | 不解决「每次在生产机 next build」的时间；base 镜像仍依赖 Hub 加速器 |
| **境外 CI 构建** | 曾用 GHCR | 构建机可能更快 | 向中国区交付镜像成本高（已踩坑） |

**Playwright 特有**：

- 浏览器二进制默认 Microsoft CDN；必须 `PLAYWRIGHT_DOWNLOAD_HOST` 或代理。
- `install-deps` / apt 字体库与浏览器绑定；改字体列表会打掉 runner apt 缓存。
- 覆盖截图需要 CJK 字体（open-ox runner 已装 `fonts-noto-cjk` 等）——这部分体积与时间应视为**准静态层**。

**Next.js 特有**：

- standalone 减小 Node 运行集，但 `NEXT_PUBLIC_*` 在 build 时嵌入 → **改公开环境变量会强制 rebuild**（无法只靠「换 env 文件重启」完成全部前端配置变更）。
- 生产 bind-mount `sites` 使「代码镜像」与「用户站点数据」分离是正确的；更说明**镜像应稳定、可快速替换**，数据不必打进镜像。

---

## 5. Recommendations for open-ox

按**预期缩短部署墙钟时间的影响**排序（高 → 低）。均不要求立刻改代码；实施时可另开 issue。

1. **确认生产机 Docker daemon 已配置腾讯云内网 Hub 加速**  
   `registry-mirrors: ["https://mirror.ccs.tencentyun.com"]`，`docker info` 可见。否则每次 miss 的 `FROM node:20-bookworm-slim` 仍慢。  
   来源：[腾讯云 Docker 加速](https://cloud.tencent.com/document/product/213/8623)。

2. **把「apt 字体/库 + Playwright Chromium」固化为 TCR（或本地）base 镜像，应用部署只重建 builder/runner 应用层**  
   目标：日常 `deploy-on-server.sh` 不再执行长时间 apt / `playwright install`。  
   来源：Docker 层缓存规则；TCR 推拉；Playwright 体积。

3. **（中期）CI 在腾讯云同地域构建 → 推 TCR → 服务器只 `compose pull && up --no-build`**  
   保留 rsync 仅用于 compose/env/非镜像文件（或 sites 数据），避免「生产机 next build」。若坚持本机构建，至少把成功构建的 tag push 到 TCR 作回滚源。  
   来源：[TCR 个人版/企业版](https://cloud.tencent.com/document/product/1141/63910)；现有 GHCR 失败经验。

4. **保持并审计国内源默认值**（已基本落地）  
   - apt → `mirrors.cloud.tencent.com`（确认 bookworm DEB822 `.sources` 也被 sed）。  
   - npm → `registry.npmmirror.com` 或腾讯 `mirrors.tencent.com/npm/`。  
   - Playwright → `PLAYWRIGHT_DOWNLOAD_HOST` 指向 npmmirror Playwright binaries。  
   冷构建后抽查日志：不应再出现 `Get: http://deb.debian.org/...` 长间隔。  
   来源：§2.2。

5. **强化 BuildKit 缓存纪律**  
   - 继续 pnpm `RUN --mount=type=cache`；考虑 apt 同样 cache mount。  
   - 严禁在 `deps`/`browsers` 之前 `COPY` 常变源码。  
   - 避免无必要的 `--no-cache`。  
   来源：[Optimize cache](https://docs.docker.com/build/cache/optimize/)。

6. **rsync / `.dockerignore` 持续收紧**  
   只同步构建所需；排除测试产物、本地 `.next`、文档大文件等，缩短 context 与 SSH 时间。  
   来源：Docker context 优化。

7. **不要用 SCF 承载主站 + Playwright**；TKE 仅在需要多副本/正式编排时再评估。  
   来源：SCF 配额与只读根限制。

8. **监控与分层计时**  
   在 `deploy-on-server.sh` 或 CI 对 `compose build` 各阶段打时间戳（base pull / apt / pnpm / playwright / next build），用数据验证换源与 base 镜像收益——避免凭感觉优化。

---

## 6. 来源索引（一手）

| 主题 | URL |
|------|-----|
| 腾讯云软件源（apt/npm/Docker 加速等） | https://cloud.tencent.com/document/product/213/8623 |
| 腾讯云 Debian 镜像帮助 | https://mirrors.cloud.tencent.com/help/debian.html |
| 轻量：Docker + 镜像加速 | https://cloud.tencent.com/document/product/1207/45596 |
| CVM：搭建 Docker | https://cloud.tencent.com/document/product/213/46000 |
| TCR 产品概述 | https://cloud.tencent.com/document/product/1141/39278 |
| TCR 个人版快速入门 | https://cloud.tencent.com/document/product/1141/63910 |
| TCR 计费 / COS | https://cloud.tencent.com/document/product/1141/40540 |
| TCR 多地域复制 | https://cloud.tencent.com/document/product/1141/52095 |
| TKE 境外镜像加速 | https://cloud.tencent.com/document/product/457/51237 |
| TKE + TCR 内网免密 | https://cloud.tencent.com/document/product/1141/48184 |
| SCF 配额 | https://cloud.tencent.com/document/product/583/11637 |
| Docker build cache | https://docs.docker.com/build/cache |
| Docker cache optimize | https://docs.docker.com/build/cache/optimize/ |
| Docker Hub registry mirror | https://docs.docker.com/docker-hub/image-library/mirror/ |
| Playwright browsers / DOWNLOAD_HOST | https://playwright.dev/docs/browsers |
| npmmirror | https://web.npmmirror.com/ |
| cnpmcore / npmmirror 赞助说明 | https://github.com/cnpm/cnpmcore |
| Next.js standalone output | https://nextjs.org/docs/pages/api-reference/config/next-config-js/output |

---

## 7. 不在本文结论内的事项

- 未实测当前生产机 `docker info` 是否已含 `mirror.ccs.tencentyun.com`（需运维现场确认）。
- 未比较个人版 vs 企业版 TCR 的具体月费；选型以配额/SLA/内网需求为准。
- 未评估第三方非官方「Docker Hub 加速域名」稳定性（本文只引用腾讯云文档中的内网加速器）。
