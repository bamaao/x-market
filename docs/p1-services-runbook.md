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

# P1 链下服务 Runbook

> Testnet 预发；主网替换 RPC / 域名 / 密钥托管。

## 服务一览

| 服务 | 端口 | 用途 | P1 项 |
|------|------|------|-------|
| gas-station | 8787 | Prophet commit 赞助 | 0.4 / 1.7 |
| lp-guard-keeper | 8788 | LP 风险参数调控 | 0.5 |
| chain-monitor | 8789 | 事件/池状态/服务健康监控 | 1.1 |
| oracle-relayer | 8790 | DataFeed 到期提议提醒 | 1.3 |
| walrus-relay | 8791 | Walrus 上传代理 | 1.4 |

## 启动

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1          # 含 P1 服务
.\scripts\verify-services-health.ps1 -IncludeP1
.\scripts\check-gas-balances.ps1
```

仅 P0：`.\scripts\start-services-testnet.ps1 -P0Only`

## 健康端点

| URL | 说明 |
|-----|------|
| `:8787/health` | Gas payer 余额 |
| `:8788/health` | Keeper 余额与池数量 |
| `:8789/health` | 监控器错误与开放告警数 |
| `:8789/metrics` | 24h 事件计数、paused 池、SlashRecord 数 |
| `:8789/alerts` | 当前告警列表 |
| `:8790/health` | Relayer 最近 tick 与 reminders |
| `:8791/health` | Walrus relay upstream |

## RPC 高可用（P1.5）

所有服务支持：

```
SUI_RPC_URL=https://your-primary.rpc
SUI_RPC_URL_FALLBACK=https://your-fallback.rpc
```

前端：

```
NEXT_PUBLIC_SUI_RPC_URL=
NEXT_PUBLIC_SUI_RPC_URL_FALLBACK=
```

## 告警 Webhook（P1.1 / 1.7）

在 `gas-station`、`chain-monitor`、`oracle-relayer` 的 `.env.local` 设置：

```
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

触发场景：Gas 余额低、Keeper 余额低、池 paused、Oracle 提议提醒。

## 主网 Walrus Relay（P1.4）

1. 部署 `walrus-relay` 至内网或边缘节点
2. 设置 `WALRUS_UPSTREAM_PUBLISHER_URL` 为主网 Walrus publisher
3. 可选 `WALRUS_RELAY_API_KEY` + 前端 header（若需鉴权）
4. 前端 `NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://walrus-relay.your-domain.com`

## 资金运维（P1.7）

```powershell
# Testnet 补水
.\scripts\fund-gas-payer-testnet.ps1

# 检查
.\scripts\check-gas-balances.ps1 -FailOnLow
```

主网：Gas Payer 冷钱包定期转账至热钱包；`GAS_MIN_BALANCE_MIST` 建议 ≥ 2 SUI。

## Docker

```powershell
docker compose -f docker-compose.services.yml up -d --build
```

## 日志

`.run/gas-station.log` · `lp-guard-keeper.log` · `chain-monitor.log` · `oracle-relayer.log` · `walrus-relay.log`
