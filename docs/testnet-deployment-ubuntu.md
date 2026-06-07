# X-Market Sui — Testnet 测试环境部署指南（Ubuntu 24.04）

> **适用系统：** Ubuntu 24.04 LTS（其他 Debian/Ubuntu 版本通常兼容）  
> **链上配置：** [deploy/testnet-v2.json](../deploy/testnet-v2.json)  
> **Package v3：** `0x2e368e…ae6e`（`unlock_price=0` 免费 Commit 已修复）  
> **Windows 部署：** 见 [testnet-deployment.md](./testnet-deployment.md)

本文档覆盖 Ubuntu 测试机上的完整部署：前端、链下服务（P0–P1）、Indexer（P2）、Pricing Engine（P3）、Prophet Audit Keeper（P4 可选）。

---

## 1. 架构概览

```
浏览器 (localhost:3000)
    │
    ├── Sui RPC (Testnet) ──────────────► 链上合约 v3
    ├── Gas Station (:8787) ────────────► 赞助 Prophet PTB
    ├── Walrus Relay (:8791) ─────────► PUT /v1/blobs → Walrus Publisher
    ├── Indexer API (:8800) ──────────► PostgreSQL (:5432)
    └── Pricing Engine (:8801) ───────► 交易预览报价

后台 Keeper / Monitor
    ├── LP Guard Keeper (:8788)
    ├── Chain Monitor (:8789)
    ├── Oracle Relayer (:8790)
    └── Prophet Audit Keeper (:8792, 可选)
```

---

## 2. 前置条件

| 工具 | 版本建议 | 用途 |
|------|----------|------|
| **Node.js** | ≥ 20 | 前端 + 链下服务 |
| **npm** | ≥ 10 | 依赖安装 |
| **Sui CLI** | 最新 testnet | 导出 deployer 密钥、领水 |
| **Docker Engine** | 可选 | P2 Indexer 用 Postgres（推荐） |
| **curl** | — | 健康检查 |
| **python3** | 3.12（系统自带） | 解析 deploy JSON |
| **Git** | — | 拉取代码 |

### 2.1 一键安装依赖

```bash
chmod +x scripts/*.sh scripts/lib/*.sh

# 基础包：Node 20、curl、git、python3、lsof
./scripts/install-ubuntu-prerequisites.sh

# 含 Docker + Sui CLI（推荐首次部署）
./scripts/install-ubuntu-prerequisites.sh --with-docker --with-sui

# 安装 Docker 后需重新登录，或：
newgrp docker
```

### 2.2 手动安装（可选）

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

# Sui CLI
curl -fsSL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
suiup install sui --testnet
```

### 2.3 Sui 钱包

链下服务需使用 **deployer 地址** 私钥（种子池 `authority`）：

```
Deployer: 0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07
```

```bash
sui client switch --env testnet
sui client active-address   # 应等于 deploy/testnet-v2.json 中的 deployer

# Gas 不足时
./scripts/fund-gas-payer-testnet.sh
sui client gas
```

> 非 deployer 钱包：Gas Station 可部分工作，LP Guard Keeper **无法**更新池参数。

### 2.4 端口

| 端口 | 服务 |
|------|------|
| 3000 | Next.js 前端 |
| 5432 | PostgreSQL |
| 8787–8792 | 链下服务 |
| 8800 | Indexer API |
| 8801 | Pricing Engine |

防火墙（若对外暴露）：

```bash
sudo ufw allow 3000/tcp   # 前端（开发）
sudo ufw allow 8787:8792/tcp
sudo ufw allow 8800:8801/tcp
```

---

## 3. 部署档位（Profile）

| Profile | 包含组件 | 典型用途 |
|---------|----------|----------|
| `frontend` | 仅前端 env + npm | 只看 UI、直连 RPC |
| `p0` | Gas Station + LP Guard | Prophet 免费 Commit、LP 防守 |
| `p1` | P0 + Monitor + Oracle Relayer + Walrus Relay | **推荐默认** |
| `p2` | P1 + Postgres + Indexer | 首页发现、排行榜、IV 曲线 |
| `full` | P2 + Pricing Engine + Prophet Audit Keeper | 完整测试栈 |

---

## 4. 一键部署（推荐）

```bash
git clone <your-repo> x-market-sui
cd x-market-sui
chmod +x scripts/*.sh scripts/lib/*.sh

# 默认 P1
./scripts/deploy-testnet.sh

# 仅前端
./scripts/deploy-testnet.sh --profile frontend

# 含 Indexer（自动 docker compose postgres）
./scripts/deploy-testnet.sh --profile p2

# 完整栈
./scripts/deploy-testnet.sh --profile full

# Keeper 仅观察、不发链上 tx
./scripts/deploy-testnet.sh --dry-run-keeper

# 跳过 env 生成
./scripts/deploy-testnet.sh --skip-bootstrap
```

### 4.1 启动前端

```bash
cd app
npm run dev
# → http://localhost:3000
# 远程访问：npm run dev -- -H 0.0.0.0
```

### 4.2 验证与停止

```bash
./scripts/verify-testnet-deployment.sh --profile p1
./scripts/stop-testnet.sh
./scripts/stop-testnet.sh --profile p2 --keep-postgres   # 保留 Postgres 数据
```

---

## 5. 分步手动部署

### 5.1 生成环境变量

```bash
./scripts/bootstrap-services-env.sh
./scripts/bootstrap-services-env.sh --dry-run-keeper
./scripts/bootstrap-indexer-env.sh    # P2+
```

生成文件（**勿提交 git**）：

| 路径 | 说明 |
|------|------|
| `services/gas-station/.env.local` | Gas Payer 私钥 |
| `services/lp-guard-keeper/.env.local` | Keeper 私钥、池 ID |
| `services/chain-monitor/.env.local` | 监控 |
| `services/oracle-relayer/.env.local` | Oracle 扫描 |
| `services/walrus-relay/.env.local` | Walrus 代理 |
| `services/prophet-audit-keeper/.env.local` | 审计 Keeper |
| `services/indexer/.env.local` | Postgres 连接 |
| `app/.env.local` | 前端配置 |

### 5.2 链下服务

```bash
./scripts/start-services-testnet.sh
./scripts/start-services-testnet.sh --p0-only
./scripts/start-services-testnet.sh --include-p4

./scripts/verify-services-health.sh --include-p1
```

### 5.3 Indexer + PostgreSQL

```bash
docker compose -f docker-compose.indexer.yml up -d postgres
./scripts/bootstrap-indexer-env.sh
./scripts/start-indexer.sh
./scripts/verify-indexer-health.sh
```

### 5.4 Pricing Engine

```bash
./scripts/start-pricing-engine.sh
curl -s http://localhost:8801/health | python3 -m json.tool
```

### 5.5 Docker Compose 全服务

```bash
./scripts/bootstrap-services-env.sh
docker compose -f docker-compose.services.yml up -d --build
./scripts/verify-services-health.sh --include-p1
```

---

## 6. systemd 生产化（可选）

开发阶段用 `nohup` + `.run/*.pid` 即可。长期运行可写 systemd unit，示例：

```ini
# /etc/systemd/system/x-market-gas-station.service
[Unit]
Description=X-Market Gas Station (Testnet)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/x-market-sui/services/gas-station
EnvironmentFile=/opt/x-market-sui/services/gas-station/.env.local
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now x-market-gas-station
```

对其他服务（lp-guard-keeper、walrus-relay 等）复制并修改 `WorkingDirectory` / `EnvironmentFile`。

---

## 7. 链上资源（Testnet v3）

| 资源 | ID |
|------|-----|
| Package v3 | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| GlobalConfig | `0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08` |
| Prophet Registry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |

完整 ID 见 [deploy/testnet-v2.json](../deploy/testnet-v2.json)。

---

## 8. 验收清单

```bash
# P1 健康
curl -s http://localhost:8787/health | python3 -m json.tool
curl -s http://localhost:8791/health | python3 -m json.tool

# P2 Indexer
curl -s http://localhost:8800/v1/markets | python3 -m json.tool

# 日志
tail -f .run/gas-station.log
tail -f .run/lp-guard-keeper.log
tail -f .run/indexer.log
```

- [ ] Gas Payer SUI 余额充足
- [ ] `/prophet` 免费 Commit 可走 Gas Station
- [ ] Walrus 上传经本地 relay（8791）
- [ ] Indexer `/v1/markets` 有种子市场（P2+）

---

## 9. 排错

| 现象 | 处理 |
|------|------|
| `Permission denied` 运行脚本 | `chmod +x scripts/*.sh scripts/lib/*.sh` |
| `docker: permission denied` | `sudo usermod -aG docker $USER` 后重新登录 |
| 密钥导出失败 | 确认 `sui client active-address` = deployer |
| 端口占用 | `./scripts/stop-testnet.sh` 或 `fuser -k 8787/tcp` |
| Indexer 连不上 DB | `docker compose -f docker-compose.indexer.yml ps` |
| npm 编译 native 模块失败 | `sudo apt install build-essential` |

---

## 10. 脚本索引（Linux）

| 脚本 | 说明 |
|------|------|
| `install-ubuntu-prerequisites.sh` | 安装 Node / 可选 Docker+Sui |
| `deploy-testnet.sh` | **一键部署** |
| `stop-testnet.sh` | **一键停止** |
| `verify-testnet-deployment.sh` | 部署验证 |
| `bootstrap-services-env.sh` | 生成链下服务 env |
| `bootstrap-indexer-env.sh` | 生成 Indexer env |
| `start-services-testnet.sh` | 启动 P0/P1 服务 |
| `start-indexer.sh` | 启动 Indexer |
| `start-pricing-engine.sh` | 启动 Pricing Engine |
| `fund-gas-payer-testnet.sh` | Testnet 领水 |
| `lib/testnet-common.sh` | 公共函数库 |

Windows 等价脚本见 [testnet-deployment.md](./testnet-deployment.md)（`*.ps1`）。

---

## 11. 相关文档

- [services-testnet-runbook.md](./services-testnet-runbook.md)
- [p1-services-runbook.md](./p1-services-runbook.md)
- [p2-indexer-runbook.md](./p2-indexer-runbook.md)
- [prophet-playbook.md](./prophet-playbook.md)
