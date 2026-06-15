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

**English** | [简体中文](./services-testnet-runbook.zh.md)

# Testnet Off-chain Services Deployment Runbook (P0.4 / P0.5)

Testnet staging/production workflow for Gas Station and LP Guard Keeper.

---

## 1. One-click Deployment

```powershell
# Generate .env.local (from deploy/testnet-v2.json + sui active address key export; do not commit to git)
.\scripts\bootstrap-services-env.ps1

# First run: use DRY_RUN to observe Keeper logs
.\scripts\bootstrap-services-env.ps1 -DryRunKeeper

# Install dependencies and start in background
.\scripts\start-services-testnet.ps1

# Health check
.\scripts\verify-services-health.ps1

# Stop
.\scripts\stop-services-testnet.ps1
```

---

## 2. Endpoints

| Service | Port | Health Check | Description |
|------|------|----------|------|
| Gas Station | 8787 | `GET /health` | `POST /v1/sponsor` sponsors Prophet PTB |
| LP Guard Keeper | 8788 | `GET /health` | Polls seed pools and calls `set_lp_guard_params` |

Frontend: `NEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787` in `app/.env.local`

---

## 3. Production Switches

| Variable | Gas Station | LP Guard |
|------|-------------|----------|
| Production mode | `GAS_STATION_PRODUCTION=true` | `LP_GUARD_PRODUCTION=true` |
| Keys | `GAS_PAYER_PRIVATE_KEY` | `LP_GUARD_KEEPER_SECRET_KEY` (must = pool `authority`) |
| Package ID | `PACKAGE_ID` (v3) | `X_MARKET_PACKAGE_ID` |
| CORS | `CORS_ORIGIN=http://localhost:3000` | — |
| On-chain tx | — | `LP_GUARD_DRY_RUN=false` |

---

## 4. Docker (Optional)

```powershell
.\scripts\bootstrap-services-env.ps1
docker compose -f docker-compose.services.yml up -d --build
.\scripts\verify-services-health.ps1
```

---

## 5. Ops Checklist

- [ ] `/health` returns `ok: true`, Gas Payer balance > `GAS_MIN_BALANCE_MIST`
- [ ] Keeper `keeper` address matches seed pool `authority`
- [ ] After `LP_GUARD_DRY_RUN=false`, `.run/lp-guard-keeper.log` shows `lp_guard_tick`
- [ ] `/prophet` free Commit works via Gas Station sponsorship
- [ ] Keys exist only in `.env.local` (listed in `.gitignore`)

---

## 6. Logs

```
.run/gas-station.log
.run/lp-guard-keeper.log
```

Keeper structured logs: `lp_guard_tick` / `lp_guard_updated` / `lp_guard_error`
