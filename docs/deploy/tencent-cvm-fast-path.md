# open-ox 腾讯云快速部署（PM2）

**日期**：2026-07-15  
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
         └── open-ox-generation-worker
```

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

准备 `.env.production`（通常由 CI 写入）。首次部署：

```bash
cd /sharedata/wayne/open-ox
bash scripts/deploy-on-server.sh
pm2 ls
pm2 startup   # 按提示做开机自启
pm2 save
curl -sS http://127.0.0.1:3000/health
```

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

1. `pm2 ls` — 两个进程 online  
2. `pm2 logs open-ox-generation-worker --lines 80`  
3. `df -h`  
4. 封面失败 → 删 `.open-ox/playwright-chromium.ok` 后重跑 deploy  
