# open-ox 腾讯云快速部署（PM2）

**日期**：2026-07-15（2026-07-17 补充预览子域）  
**目标机器**：腾讯云中国区单机 CVM  
**日常发版**：`rsync` →（按需）`pnpm install` → `pnpm build` → `pm2 reload`

---

## 0. 架构

```
GitHub push (main)
    │
    ▼
CI：typecheck + tests
    │
    ▼
rsync 源码 → /sharedata/wayne/open-ox
    │  （保留服务器 node_modules / .next / sites/<id> / Playwright 浏览器）
    ▼
deploy-on-server.sh
    ├─ lockfile 未变 → 跳过 pnpm install
    ├─ template lock 未变 → 跳过 template install
    ├─ Playwright 已装 → 跳过 browser download
    ├─ pnpm build（复用 .next/cache；类型靠 CI）
    └─ pm2 startOrReload ecosystem.config.cjs
         ├── open-ox                 (next start)
         ├── open-ox-generation-worker
         └── open-ox-screenshot      (Playwright HTTP :3921)
```

封面 / 参考页截图由 **Screenshot Service** 完成；Next 只发本机 HTTP（`OPEN_OX_SCREENSHOT_URL`，默认 `http://127.0.0.1:3921`）。鉴权：`OPEN_OX_SCREENSHOT_SECRET` 或回退 `OPEN_OX_PREVIEW_CAPTURE_SECRET`。

本地开发另开终端：`pnpm screenshot:dev`（与 `pnpm dev` 并行）。

---

## 1. 服务器：清掉旧 Docker（一次性）

```bash
# 拉到含 scripts/server-cleanup-docker.sh 的代码后：
sudo bash /sharedata/wayne/open-ox/scripts/server-cleanup-docker.sh

# 若确认不再用 Docker，可再卸引擎腾出 /var/lib/docker：
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-compose-v2 || true
sudo rm -rf /var/lib/docker /var/lib/containerd
sudo apt-get autoremove -y
df -h /
```

**不会删除** `sites/` 下用户生成站。

---

## 2. 服务器：PM2 预装（一次性）

```bash
sudo OPEN_OX_DEPLOY_USER=ubuntu bash /sharedata/wayne/open-ox/scripts/server-setup.sh
```

会装：Node 20、pnpm、pm2、CJK 字体、Playwright 系统库。

确认：

```bash
node -v    # v20.x
pnpm -v
pm2 -v
```

准备 `.env.production`（通常由 CI 写入；需含 `OPEN_OX_PREVIEW_CAPTURE_SECRET` 或 `OPEN_OX_SCREENSHOT_SECRET`）。首次部署：

```bash
cd /sharedata/wayne/open-ox
bash scripts/deploy-on-server.sh
pm2 ls
# 应看到 open-ox / open-ox-generation-worker / open-ox-screenshot 均为 online
pm2 startup   # 按提示做开机自启
pm2 save
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:3921/health
```

---

## 2.1 静态预览子域（可选，推荐）

目标：`NEXT_PUBLIC_PREVIEW_ORIGIN=https://p.open-ox.tech`，与主站 cookie 隔离；nginx 对 `/_next/static/` 做磁盘缓存。

1. DNS：`p.open-ox.tech` A/AAAA → 同 CVM  
2. 证书：`sudo certbot --nginx -d open-ox.tech -d www.open-ox.tech -d p.open-ox.tech`  
3. 应用示例配置：`deploy/open-ox.tech.conf.example`（含 `p.open-ox.tech` server + `proxy_cache_path`）  
4. 缓存目录：`sudo mkdir -p /var/cache/nginx/open-ox-preview && sudo chown www-data:www-data /var/cache/nginx/open-ox-preview`  
5. GitHub Actions secret（推荐）：
   - `NEXT_PUBLIC_PREVIEW_ORIGIN=https://p.open-ox.tech`
   - 未设置时，CI 会从 `NEXT_PUBLIC_SITE_URL` **推导**为 `https://p.<site-host>`（去掉 `www.`）
   - CI 写入 `.env.production` 后随 rsync 到服务器；`deploy-on-server.sh` 在 **`pnpm build` 前** 加载（rewrites 进构建产物）
6. `sudo nginx -t && sudo systemctl reload nginx` → `bash scripts/deploy-on-server.sh`  
7. 验证：打开 Studio 预览，Network 里资源 host 为 `p.open-ox.tech`；二次加载看响应头 `X-Open-OX-Nginx-Cache: HIT` 或 `X-Open-OX-Preview-Cache: HIT`。

未配置时仍走主站 `/site-previews/{id}`，行为不变。

---

## 3. 日常发版

推 `main` 即可。或：

```bash
cd /sharedata/wayne/open-ox && bash scripts/deploy-on-server.sh
```

| 场景 | 目标 |
|------|------|
| 只改业务代码 | ≈ 3–6 min（build + reload） |
| lockfile 变更 | 多一次 install |
| 冷机首次 | 含 Playwright chromium 下载 |

---

## 4. 诊断

1. `pm2 ls` — **三个**进程 online（含 `open-ox-screenshot`）  
2. `pm2 logs open-ox-screenshot --lines 80` / `pm2 logs open-ox-generation-worker --lines 80`  
3. `df -h`  
4. 封面失败 → 确认 screenshot 进程与 secret；或删 `.open-ox/playwright-chromium.ok` 后重跑 deploy  
