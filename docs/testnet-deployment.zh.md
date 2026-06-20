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

**简体中文** | [English](./testnet-deployment.md)

# X-Market Sui — Testnet 测试环境部署指南

> **适用环境：** Sui Testnet · **链上配置：** [deploy/testnet-v2.json](../deploy/testnet-v2.json)  
> **Package v3：** `0x2e368e…ae6e`（`unlock_price=0` 免费 Commit 已修复）  
> **Ubuntu 24 部署：** 见 [testnet-deployment-ubuntu.md](./testnet-deployment-ubuntu.md)

本文档覆盖**本地/测试机**完整部署流程：前端、链下服务（P0–P1）、Indexer（P2）、Pricing Engine（P3）、Prophet Audit Keeper（P4 可选）。

---

## 1. 架构概览

```
浏览器 (localhost:3000)
    │
    ├── Sui RPC (Testnet) ──────────────► 链上合约 v3
    ├── LP Guard Keeper (:8788) ──────────► 种子池动态费率
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
| **Sui CLI** | 最新 testnet | 导出 deployer 密钥、领水、链上操作 |
| **Docker Desktop** | 可选 | P2 Indexer 用 Postgres（推荐） |
| **Git** | — | 拉取代码 |

### 2.1 Sui 钱包

链下服务（LP Guard Keeper 等）需使用 **deployer 地址** 的私钥，且该地址须为种子池 `authority`：

```
Deployer: 0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07
```

```powershell
# 切换到 testnet 并导入/激活 deployer
sui client switch --env testnet
sui client active-address   # 应等于 deploy/testnet-v2.json 中的 deployer

# 若 Gas 不足
.\scripts\fund-gas-payer-testnet.ps1
.\scripts\check-gas-balances.ps1
```

> **注意：** LP Guard Keeper 的 keeper 地址须与种子池 `authority` 一致；Prophet Commit / Unlock / Audit 由用户钱包自付 SUI Gas。

### 2.2 端口占用

| 端口 | 服务 |
|------|------|
| 3000 | Next.js 前端 |
| 5432 | PostgreSQL |
| 8788–8792 | 链下服务 |
| 8800 | Indexer API |
| 8801 | Pricing Engine |

---

## 3. 部署档位（Profile）

| Profile | 包含组件 | 典型用途 |
|---------|----------|----------|
| `frontend` | 仅前端 env + npm | 只看 UI、直连 RPC |
| `p0` | LP Guard | LP 防守 |
| `p1` | P0 + Monitor + Oracle Relayer + Walrus Relay | **推荐默认** |
| `p2` | P1 + Postgres + Indexer | 首页发现、排行榜、IV 曲线 |
| `full` | P2 + Pricing Engine + Prophet Audit Keeper | 完整测试栈 |

---

## 4. 一键部署（推荐）

在仓库根目录执行：

```powershell
# 默认：P1 档位（Keeper + Monitor + Relayer + Walrus Relay）
.\scripts\deploy-testnet.ps1

# 仅前端
.\scripts\deploy-testnet.ps1 -Profile frontend

# 含 Indexer（自动启动 Docker Postgres）
.\scripts\deploy-testnet.ps1 -Profile p2

# 完整栈
.\scripts\deploy-testnet.ps1 -Profile full

# 首次观察 Keeper 日志、不发链上 tx
.\scripts\deploy-testnet.ps1 -DryRunKeeper

# 跳过 env 生成（已 bootstrap 过）
.\scripts\deploy-testnet.ps1 -SkipBootstrap
```

### 4.1 启动前端

部署脚本**不会**阻塞启动 Next.js，需另开终端：

```powershell
cd app
npm install
npm run dev
# → http://localhost:3000
```

浏览器连接 **Testnet 钱包**（须持有测试 USDC；可用市场页「铸造」或 `.\scripts\mint-test-usdc.ps1`）。

### 4.2 验证

```powershell
.\scripts\verify-testnet-deployment.ps1 -Profile p1
.\scripts\verify-testnet-deployment.ps1 -Profile p2
```

### 4.3 停止

```powershell
.\scripts\stop-testnet.ps1              # 停止全部
.\scripts\stop-testnet.ps1 -Profile p1  # 仅停 P1 及以下服务
```

---

## 5. 分步手动部署

若需逐步排查，可按以下顺序执行。

### 5.1 生成环境变量

```powershell
# 链下服务 + app/.env.local（含 Walrus Relay URL 等）
.\scripts\bootstrap-services-env.ps1

# 可选：Keeper 仅打日志、不发链上 tx
.\scripts\bootstrap-services-env.ps1 -DryRunKeeper

# Indexer（P2+）
.\scripts\bootstrap-indexer-env.ps1
```

生成的 `.env.local` 文件（**勿提交 git**）：

| 路径 | 说明 |
|------|------|
| `services/lp-guard-keeper/.env.local` | Keeper 私钥、Package ID、池 ID 列表 |
| `services/chain-monitor/.env.local` | 监控 + 告警 webhook |
| `services/oracle-relayer/.env.local` | Oracle 到期扫描 |
| `services/walrus-relay/.env.local` | Walrus 上传代理 |
| `services/prophet-audit-keeper/.env.local` | 审计 Keeper（默认 DRY_RUN） |
| `services/indexer/.env.local` | Postgres 连接串 |
| `app/.env.local` | 前端链上 ID + 本地服务 URL |

### 5.2 链下服务（P0 / P1）

```powershell
.\scripts\start-services-testnet.ps1           # P0 + P1
.\scripts\start-services-testnet.ps1 -P0Only   # 仅 LP Guard Keeper
.\scripts\start-services-testnet.ps1 -IncludeP4  # 含 Prophet Audit Keeper

.\scripts\verify-services-health.ps1 -IncludeP1
```

### 5.3 Indexer + PostgreSQL（P2）

**方式 A — Docker（推荐）**

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
```

**方式 B — 本机 PostgreSQL**

```powershell
.\scripts\bootstrap-local-postgres.ps1   # 需 psql + postgres 超级用户
.\scripts\start-indexer.ps1
```

### 5.4 Pricing Engine（P3）

```powershell
.\scripts\start-pricing-engine.ps1
# GET http://localhost:8801/health
```

### 5.5 Docker Compose 全服务（可选）

```powershell
.\scripts\bootstrap-services-env.ps1
docker compose -f docker-compose.services.yml up -d --build
.\scripts\verify-services-health.ps1 -IncludeP1
```

Indexer 全容器：

```powershell
docker compose -f docker-compose.indexer.yml --profile full up -d --build
```

---

## 6. 链上资源（Testnet v3）

完整 ID 见 [deploy/testnet-v2.json](../deploy/testnet-v2.json)。

| 资源 | ID |
|------|-----|
| Package v3 | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| GlobalConfig | `0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08` |
| Prophet Registry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |
| Oracle Config | `0x1ad185d06bcbb53a98c5a834516da7a28c748f32079faa8ff310a35d04f663d8` |
| Poisson 池 | `0xb5d1a85213d6757d1cb386e8b719b524162a117018e6f5b8f0101f4dcc532b5f` |
| Dirichlet 池 | `0x89fb5ff5754fe5b2d32d071ce98ad778b62a48f738e0d7dd27a86b390eddaac5` |
| Normal 池 | `0xa43716a746c01d6039cd7b9e6a77562f17a8730dc72c9363ddfde06859e4f834` |

**重新发布链上合约**（一般不需要，仅 fork 新环境时）：

```powershell
.\scripts\deploy-oracle-prophet-testnet.ps1   # 全新 publish
.\scripts\upgrade-testnet.ps1                 # 在现有包上 upgrade
```

---

## 7. 功能验收清单

### P0 / P1

- [ ] `GET http://localhost:8788/health` → `ok: true`
- [ ] `GET http://localhost:8788/health` → `ok: true`
- [ ] `GET http://localhost:8791/health` → `ok: true`
- [ ] Gas Payer SUI 余额充足（`check-gas-balances.ps1`）
- [ ] `/prophet` 页 Commit / Unlock / Audit 可用（钱包有足够 Testnet SUI）
- [ ] `.run/lp-guard-keeper.log` 出现 `lp_guard_tick`（`LP_GUARD_DRY_RUN=false` 时）

### P2

- [ ] `GET http://localhost:8800/health` → `ok: true`
- [ ] `GET http://localhost:8800/v1/markets` 返回种子市场
- [ ] 首页 MarketsGrid、排行榜、IV 面板有 Indexer 数据

### P3

- [ ] `GET http://localhost:8801/health` → `ok: true`
- [ ] 市场页 TradePanel 显示定价预览

### 端到端演练

```powershell
.\scripts\run-p0-drills-testnet.ps1
# 手动 E/F 项见 docs/p0-drill-ef-checklist.md
```

---

## 8. 日志与排错

| 日志 | 路径 |
|------|------|
| 各链下服务 | `.run/<service-name>.log` |
| Indexer | `.run/indexer.log` |
| Pricing Engine | `.run/pricing-engine.log` |
| PID 文件 | `.run/*.pid` |

### 常见问题

**`bootstrap-services-env.ps1` 报密钥导出失败**  
→ 确认 `sui client active-address` 与 deployer 一致，且 keystore 可访问。

**Keeper `/health` 异常**  
→ `.\scripts\fund-gas-payer-testnet.ps1`

**Prophet blob 上传失败**  
→ 确认 Indexer 已启动（`:8800/health`）；`NEXT_PUBLIC_INDEXER_URL=http://localhost:8800`；Prophet 使用 `POST /v1/prophecies/blob`

**Indexer 连接 Postgres 失败**  
→ `docker compose -f docker-compose.indexer.yml ps` 检查 postgres 是否 healthy；或改用 `bootstrap-local-postgres.ps1`

**Keeper authority 不匹配**  
→ 必须使用 deployer 钱包；或更新 `deploy/testnet-v2.json` 后重新 bootstrap

**端口被占用**  
→ `.\scripts\stop-testnet.ps1` 后重试

---

## 9. 相关文档

| 文档 | 内容 |
|------|------|
| [services-testnet-runbook.md](./services-testnet-runbook.md) | P0 服务细节 |
| [p1-services-runbook.md](./p1-services-runbook.md) | Monitor / Relayer / Walrus Relay |
| [p2-indexer-runbook.md](./p2-indexer-runbook.md) | Indexer API 与表结构 |
| [p3-growth-runbook.md](./p3-growth-runbook.md) | Pricing Engine |
| [prophet-playbook.md](./prophet-playbook.md) | Prophet / Seal / Indexer blob 流程 |
| [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) | 前端 E2E 验收 |

---

## 10. 脚本索引

| 脚本 | 说明 |
|------|------|
| `deploy-testnet.ps1` | **一键部署**（Windows，按 Profile） |
| `deploy-testnet.sh` | **一键部署**（Ubuntu/Linux） |
| `stop-testnet.ps1` / `stop-testnet.sh` | **一键停止** |
| `verify-testnet-deployment.ps1` / `.sh` | **部署后验证** |
| `install-ubuntu-prerequisites.sh` | Ubuntu 24 依赖安装 |
| `bootstrap-services-env.ps1` / `.sh` | 生成链下服务 env |
| `bootstrap-indexer-env.ps1` / `.sh` | 生成 Indexer env |
| `start-services-testnet.ps1` / `.sh` | 启动 P0/P1 服务 |
| `start-indexer.ps1` / `.sh` | 启动 Indexer |
| `start-pricing-engine.ps1` / `.sh` | 启动 Pricing Engine |
| `verify-services-health.ps1` / `.sh` | 链下服务健康检查 |
| `verify-indexer-health.ps1` / `.sh` | Indexer 健康检查 |
| `fund-gas-payer-testnet.ps1` / `.sh` | Testnet 领水 |
| `check-gas-balances.ps1` | Gas 余额检查 |

Linux 完整说明见 [testnet-deployment-ubuntu.md](./testnet-deployment-ubuntu.md)。
