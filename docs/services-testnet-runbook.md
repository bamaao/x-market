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

# Testnet Off-Chain Services Runbook (P0.4 / P0.5)

Testnet staging/production workflow for LP Guard Keeper and other P0 services.

> **Prophet on-chain txs** (Commit / Unlock / Audit) are **paid with SUI from the user wallet**; Gas Station is no longer deployed.

---

## 1. One-Click Deploy

```powershell
# Generate .env.local (from deploy/testnet-v2.json + active sui address key; do not commit)
.\scripts\bootstrap-services-env.ps1

# Optional: DRY_RUN first to observe Keeper logs
.\scripts\bootstrap-services-env.ps1 -DryRunKeeper

# Install deps and start in background
.\scripts\start-services-testnet.ps1

# Health check
.\scripts\verify-services-health.ps1

# Stop
.\scripts\stop-services-testnet.ps1
```

---

## 2. Endpoints

| Service | Port | Health | Description |
|---------|------|--------|-------------|
| LP Guard Keeper | 8788 | `GET /health` | Poll seed pools and call `set_lp_guard_params` |

---

## 3. Production Flags

| Variable | LP Guard |
|----------|----------|
| Production mode | `LP_GUARD_PRODUCTION=true` |
| Secret key | `LP_GUARD_KEEPER_SECRET_KEY` (must match pool `authority`) |
| Package ID | `X_MARKET_PACKAGE_ID` |
| Send on-chain tx | `LP_GUARD_DRY_RUN=false` |

---

## 4. Docker (Optional)

```powershell
.\scripts\bootstrap-services-env.ps1
docker compose -f docker-compose.services.yml up -d --build
.\scripts\verify-services-health.ps1
```

---

## 5. Ops Checklist

- [ ] Keeper `/health` returns `ok: true`
- [ ] Keeper address matches seed pool `authority`
- [ ] After `LP_GUARD_DRY_RUN=false`, `.run/lp-guard-keeper.log` shows `lp_guard_tick`
- [ ] `/prophet` Commit / Unlock / Audit works (wallet has enough Testnet SUI)
- [ ] Secrets only in `.env.local` (gitignored)

---

## 6. Logs

```
.run/lp-guard-keeper.log
```

Keeper structured logs: `lp_guard_tick` / `lp_guard_updated` / `lp_guard_error`
