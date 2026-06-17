<!--
  Copyright (c) 2026 zouyc zouyccq@gmail.com.
  All rights reserved.

  Licensed under the Business Source License 1.1 (BSL 1.1).
  You may not use this file except in compliance with the License.

  Change Date: 2031-01-01
  On the Change Date, or the fourth anniversary of the first publicly available
  distribution of the code under the BSL, whichever comes first, the code
  automatically becomes available under the Apache License 2.0.
-->

**简体中文** | [English](./production-deployment.md)

# X-Market 生产部署指南（Ubuntu 后端 + Vercel 前端）

> **后端：** Ubuntu 24.04 LTS · **Docker** 或 **非 Docker（Native）** · 可选 Nginx + TLS  
> **前端：** Vercel（Next.js 15，`app/` 目录）  
> **链上配置：** [deploy/testnet-v2.json](../deploy/testnet-v2.json)

本地开发部署见 [testnet-deployment-ubuntu.zh.md](./testnet-deployment-ubuntu.zh.md)。

---

## 1. 架构

### Docker 模式（推荐）

```
Ubuntu 24.04
    ├── Nginx :443（/gas /indexer /pricing /walrus）
    └── Docker Compose（127.0.0.1:8787–8801 + Postgres）
            ├── Gas Station / Keeper / Monitor / Oracle / Walrus
            ├── PostgreSQL + Indexer（p2+）
            └── Pricing Engine（full）
```

### Native 模式（非 Docker）

```
Ubuntu 24.04
    ├── Nginx :443
    ├── Node.js 进程（npm start，日志 .run/ 或 systemd）
    │       └── Gas Station / Keeper / Monitor / Oracle / Walrus / Indexer / Pricing
    └── PostgreSQL
            ├── docker   — 仅 Postgres 用 Docker（默认，混合部署）
            ├── native   — apt 安装 PostgreSQL
            └── external — 外部托管数据库（XMARKET_INDEXER_DATABASE_URL）
```

| 组件 | 部署位置 | 公网路径示例 |
|------|----------|--------------|
| 前端 | Vercel | `https://x-market.vercel.app` |
| Gas Station | Ubuntu | `https://api.example.com/gas` |
| Indexer | Ubuntu | `https://api.example.com/indexer` |
| Pricing Engine | Ubuntu | `https://api.example.com/pricing` |

---

## 2. 前置条件

### 2.1 Ubuntu 服务器

| 项目 | 要求 |
|------|------|
| OS | Ubuntu 24.04 LTS |
| 配置 | 2 vCPU / 4 GB RAM 起（含 Indexer + Postgres） |
| 域名 | `api.example.com` A 记录指向服务器 |
| 防火墙 | 开放 80、443；**不要**对外暴露 8787–8801 |

### 2.2 密钥与链上

- Deployer 私钥（种子池 `authority`），通过环境变量注入，**不要**提交到 Git
- `deploy/testnet-v2.json`（或 mainnet 对应 JSON）与当前链上部署一致

### 2.3 Vercel

```bash
npm i -g vercel
vercel login
```

在 Vercel 控制台创建项目时，将 **Root Directory** 设为 `app`。

---

## 3. 一键部署

### 3.0 无域名：Vercel 反向代理 + 公网 IP（推荐无域名场景）

浏览器只访问 Vercel 同源路径 `/api/*`（HTTPS），由 Vercel 服务端转发到你的公网 IP（HTTP）。**公网 IP 不会出现在前端 JS 包里。**

```
浏览器 → https://xxx.vercel.app/api/gas/...  (HTTPS 同源)
              ↓ Vercel rewrite
         http://203.0.113.10:8787/...         (仅服务端可见)
```

**① Ubuntu 后端**（开放 8787、8800、8801 等端口；无需 Nginx/域名）：

```bash
export XMARKET_DEPLOYER_PRIVATE_KEY='suiprivkey1...'

# 防火墙示例
sudo ufw allow 8787/tcp
sudo ufw allow 8800/tcp
sudo ufw allow 8801/tcp

./scripts/deploy-backend-ubuntu-docker.sh \
  --frontend-url https://x-market.vercel.app \
  --api-routing vercel-proxy \
  --backend-host 203.0.113.10 \
  --profile p2 \
  --install-deps
# vercel-proxy 会自动 --expose-public-ports
```

**② Vercel 前端**：

```bash
./scripts/deploy-frontend-vercel.sh \
  --frontend-url https://x-market.vercel.app \
  --api-routing vercel-proxy \
  --backend-host 203.0.113.10 \
  --profile p2 \
  --prod
```

Vercel 环境变量（脚本会自动推送）：

| 变量 | 示例 | 可见性 |
|------|------|--------|
| `NEXT_PUBLIC_GAS_STATION_URL` | `/api/gas` | 浏览器 |
| `NEXT_PUBLIC_INDEXER_URL` | `/api/indexer` | 浏览器 |
| `BACKEND_PROXY_HOST` | `203.0.113.10` | **仅 Vercel 构建/运行时** |
| `BACKEND_PROXY_SCHEME` | `http` | 仅服务端 |

本地开发：在 `app/.env.local` 同样设置上述变量即可启用 `next.config.ts` rewrites。

> **安全提示：** 8787–8801 对公网开放后，他人若猜到 IP 可直接调用 Gas Station。请依赖服务内置限流，并尽快加防火墙白名单或改用域名 + Nginx。

### 3.1 后端 — Docker 模式（有域名）

```bash
export XMARKET_DEPLOYER_PRIVATE_KEY='suiprivkey1...'

./scripts/deploy-backend-ubuntu-docker.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --api-domain api.example.com \
  --profile p2 \
  --install-deps \
  --setup-nginx \
  --setup-ssl \
  --ssl-email ops@example.com
```

或使用统一入口（`--mode docker` 为默认）：

```bash
./scripts/deploy-backend-ubuntu.sh --mode docker ...
```

**停止：** `docker compose -f docker-compose.production.yml down`

### 3.2 后端 — Native 模式（非 Docker）

链下服务以 Node.js 进程运行；Postgres 默认仍用 Docker（仅数据库容器化）。

```bash
export XMARKET_DEPLOYER_PRIVATE_KEY='suiprivkey1...'

./scripts/deploy-backend-ubuntu-native.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --api-domain api.example.com \
  --profile p2 \
  --postgres-mode docker \
  --install-deps \
  --setup-nginx \
  --setup-ssl \
  --ssl-email ops@example.com \
  --setup-systemd
```

**Postgres 选项：**

| `--postgres-mode` | 说明 |
|-------------------|------|
| `docker`（默认） | `docker compose -f docker-compose.indexer.yml up -d postgres` |
| `native` | `setup-postgres-native.sh` 安装本机 PostgreSQL |
| `external` | 设置 `XMARKET_INDEXER_DATABASE_URL` 连接外部库 |

**停止：** `./scripts/stop-backend-production.sh --mode native --profile p2`

**日志：** `tail -f .run/gas-station.log` 或 `journalctl -u x-market-gas-station -f`

### 3.3 前端（Vercel）

```bash
# 先完成后端，确保 deploy/vercel.env.generated 已生成
./scripts/deploy-frontend-vercel.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --profile p2 \
  --prod
```

CI 非交互部署：

```bash
export VERCEL_TOKEN=...
./scripts/deploy-frontend-vercel.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --prod \
  --vercel-org your-team
```

---

## 4. 分步操作

### 4.0 PostgreSQL 建库建表

```bash
# 推荐：Docker + 迁移
./scripts/init-postgres.sh --mode docker

# 本机 PostgreSQL
./scripts/init-postgres.sh --mode native --install-native

# 仅建表（库已存在）
./scripts/run-indexer-migrations.sh
```

| 文件/脚本 | 作用 |
|-----------|------|
| `deploy/postgres/init-database.sql` | 建用户 + 建库（幂等 SQL） |
| `services/indexer/migrations/*.sql` | 建表迁移（001–007） |
| `scripts/init-postgres.sh` | 建库 + 建表一键 |
| `scripts/run-indexer-migrations.sh` | 仅执行迁移 |

详见 [deploy/postgres/README.zh.md](../deploy/postgres/README.zh.md)。

> Indexer 启动时也会自动迁移；生产部署 Docker 后若 Indexer 健康检查失败，可单独执行 `run-indexer-migrations.sh`。

### 4.1 仅生成环境变量

```bash
./scripts/bootstrap-production-env.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --profile p2
```

生成文件（**勿提交**）：

| 文件 | 用途 |
|------|------|
| `services/*/.env.local` | Docker 链下服务 |
| `deploy/vercel.env.generated` | Vercel `NEXT_PUBLIC_*` |

### 4.2 手动启动 Docker

```bash
docker compose -f docker-compose.production.yml --profile p2 up -d --build
```

### 4.3 仅配置 Nginx

```bash
sudo ./scripts/setup-nginx-api.sh \
  --api-domain api.example.com \
  --setup-ssl \
  --ssl-email ops@example.com
```

### 4.4 Vercel 环境变量（控制台）

也可在 Vercel Dashboard → Settings → Environment Variables 手动粘贴 `deploy/vercel.env.generated` 内容。

可选 GeoBlock（Edge）：

```
GEO_BLOCK_ENABLED=true
GEO_BLOCKED_COUNTRIES=US,CN
```

---

## 5. 验收

```bash
# 服务器本地
curl -s http://127.0.0.1:8787/health | python3 -m json.tool
curl -s http://127.0.0.1:8800/v1/markets | python3 -m json.tool

# 公网（Nginx path 路由）
curl -s https://api.example.com/gas/health
curl -s https://api.example.com/indexer/health
```

- [ ] Vercel 部署成功，`NEXT_PUBLIC_GAS_STATION_URL` 指向公网 API
- [ ] 浏览器连接钱包，Prophet Commit 可走 Gas Station
- [ ] Indexer `/v1/markets` 有种子市场数据

---

## 6. 运维

```bash
# 查看日志
docker compose -f docker-compose.production.yml logs -f gas-station
docker compose -f docker-compose.production.yml logs -f indexer

# 停止
docker compose -f docker-compose.production.yml down

# 升级代码后
git pull
./scripts/deploy-backend-ubuntu.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --profile p2 \
  --skip-bootstrap   # 若 env 未变
```

---

## 7. 脚本索引

| 脚本 | 说明 |
|------|------|
| `deploy-backend-ubuntu.sh` | 统一入口（`--mode docker\|native`） |
| `deploy-backend-ubuntu-docker.sh` | **Docker 全栈部署** |
| `deploy-backend-ubuntu-native.sh` | **非 Docker 部署** |
| `start-backend-production-native.sh` | 启动 Native 进程 |
| `stop-backend-production.sh` | 停止生产后端 |
| `setup-postgres-native.sh` | 本机 PostgreSQL 安装 |
| `init-postgres.sh` | **建库 + 建表一键** |
| `run-indexer-migrations.sh` | **仅 Indexer 建表迁移** |
| `deploy/postgres/init-database.sql` | 建库 SQL |
| `setup-systemd-production.sh` | Native 模式 systemd 单元 |
| `deploy-frontend-vercel.sh` | **Vercel 前端一键部署** |
| `bootstrap-production-env.sh` | 生成生产 env + Vercel 变量 |
| `setup-nginx-api.sh` | Nginx 反向代理 + 可选 certbot |
| `docker-compose.production.yml` | Docker 生产 Compose |
| `deploy/nginx/api.conf.template` | Nginx 配置模板 |

**Profile：**

| Profile | 内容 |
|---------|------|
| `p1` | Gas Station + Keeper + Monitor + Oracle + Walrus |
| `p2` | P1 + Postgres + Indexer（**推荐**） |
| `full` | P2 + Pricing Engine |

---

## 8. 故障排查

| 现象 | 处理 |
|------|------|
| Gas Station CORS 错误 | 确认 `CORS_ORIGIN` = Vercel 前端 URL（无尾斜杠） |
| 前端连不上 API | 检查 Nginx、`NEXT_PUBLIC_*` 是否为 `https://api.../gas` 形式 |
| Indexer 无数据 | `docker compose logs indexer`；确认 Postgres healthy |
| certbot 失败 | 域名 DNS 是否已生效；80 端口是否可达 |

---

## 9. 相关文档

- [testnet-deployment-ubuntu.zh.md](./testnet-deployment-ubuntu.zh.md) — 本地/测试机部署
- [p2-indexer-runbook.md](./p2-indexer-runbook.md) — Indexer 运维
- [p3-growth-runbook.md](./p3-growth-runbook.md) — GeoBlock
