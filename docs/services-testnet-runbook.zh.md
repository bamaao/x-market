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

**简体中文** | [English](./services-testnet-runbook.md)

# Testnet 链下服务部署 Runbook（P0.4 / P0.5）

Gas Station 与 LP Guard Keeper 的 Testnet 预发/生产化流程。

---

## 1. 一键部署

```powershell
# 生成 .env.local（从 deploy/testnet-v2.json + sui 活跃地址导出密钥，勿提交 git）
.\scripts\bootstrap-services-env.ps1

# 首次可先用 DRY_RUN 观察 Keeper 日志
.\scripts\bootstrap-services-env.ps1 -DryRunKeeper

# 安装依赖并后台启动
.\scripts\start-services-testnet.ps1

# 健康检查
.\scripts\verify-services-health.ps1

# 停止
.\scripts\stop-services-testnet.ps1
```

---

## 2. 端点

| 服务 | 端口 | 健康检查 | 说明 |
|------|------|----------|------|
| Gas Station | 8787 | `GET /health` | `POST /v1/sponsor` 赞助 Prophet PTB |
| LP Guard Keeper | 8788 | `GET /health` | 轮询种子池并 `set_lp_guard_params` |

前端：`app/.env.local` 中 `NEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787`

---

## 3. 生产化开关

| 变量 | Gas Station | LP Guard |
|------|-------------|----------|
| 生产模式 | `GAS_STATION_PRODUCTION=true` | `LP_GUARD_PRODUCTION=true` |
| 密钥 | `GAS_PAYER_PRIVATE_KEY` | `LP_GUARD_KEEPER_SECRET_KEY`（须 = 池 `authority`） |
| 包 ID | `PACKAGE_ID`（v3） | `X_MARKET_PACKAGE_ID` |
| CORS | `CORS_ORIGIN=http://localhost:3000` | — |
| 发链上 tx | — | `LP_GUARD_DRY_RUN=false` |

---

## 4. Docker（可选）

```powershell
.\scripts\bootstrap-services-env.ps1
docker compose -f docker-compose.services.yml up -d --build
.\scripts\verify-services-health.ps1
```

---

## 5. 运维检查清单

- [ ] `/health` 返回 `ok: true`，Gas Payer 余额 > `GAS_MIN_BALANCE_MIST`
- [ ] Keeper `keeper` 地址与种子池 `authority` 一致
- [ ] `LP_GUARD_DRY_RUN=false` 后 `.run/lp-guard-keeper.log` 出现 `lp_guard_tick`
- [ ] `/prophet` 免费 Commit 可走 Gas Station 赞助
- [ ] 密钥仅存在于 `.env.local`（已在 `.gitignore`）

---

## 6. 日志

```
.run/gas-station.log
.run/lp-guard-keeper.log
```

Keeper 结构化日志：`lp_guard_tick` / `lp_guard_updated` / `lp_guard_error`
