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

**English** | [简体中文](./p1-services-runbook.zh.md)

# P1 Off-chain Services Runbook

> Testnet staging; replace RPC / domain / key custody for mainnet.

## Service Overview

| Service | Port | Purpose | P1 Items |
|------|------|------|-------|
| lp-guard-keeper | 8788 | LP risk parameter tuning | 0.5 |
| chain-monitor | 8789 | Event / pool state / service health monitoring | 1.1 |
| oracle-relayer | 8790 | DataFeed expiry proposal reminders | 1.3 |
| walrus-relay | 8791 | Walrus upload proxy | 1.4 |

## Startup

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1          # includes P1 services
.\scripts\verify-services-health.ps1 -IncludeP1
.\scripts\check-gas-balances.ps1
```

P0 only: `.\scripts\start-services-testnet.ps1 -P0Only`

## Health Endpoints

| URL | Description |
|-----|------|
| `:8788/health` | Keeper balance and pool count |
| `:8789/health` | Monitor errors and open alert count |
| `:8789/metrics` | 24h event count, paused pools, SlashRecord count |
| `:8789/alerts` | Current alert list |
| `:8790/health` | Relayer last tick and reminders |
| `:8791/health` | Walrus relay upstream |

## RPC High Availability (P1.5)

All services support:

```
SUI_RPC_URL=https://your-primary.rpc
SUI_RPC_URL_FALLBACK=https://your-fallback.rpc
```

Frontend:

```
NEXT_PUBLIC_SUI_RPC_URL=
NEXT_PUBLIC_SUI_RPC_URL_FALLBACK=
```

## Alert Webhook (P1.1 / 1.7)

Set in `.env.local` for `chain-monitor` and `oracle-relayer`:

```
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Trigger scenarios: low Gas balance, low Keeper balance, pool paused, Oracle proposal reminders.

## Mainnet Walrus Relay (P1.4)

1. Deploy `walrus-relay` to an internal or edge node
2. Set `WALRUS_UPSTREAM_PUBLISHER_URL` to the mainnet Walrus publisher
3. Optional `WALRUS_RELAY_API_KEY` + frontend header (if auth is required)
4. Frontend `NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://walrus-relay.your-domain.com`

## Fund Operations (P1.7)

```powershell
# Testnet refill
.\scripts\fund-gas-payer-testnet.ps1

# Check
.\scripts\check-gas-balances.ps1 -FailOnLow
```

Mainnet: periodically transfer from Gas Payer cold wallet to hot wallet; `GAS_MIN_BALANCE_MIST` recommended ≥ 2 SUI.

## Docker

```powershell
docker compose -f docker-compose.services.yml up -d --build
```

## Logs

`.run/lp-guard-keeper.log` · `chain-monitor.log` · `oracle-relayer.log` · `walrus-relay.log`
