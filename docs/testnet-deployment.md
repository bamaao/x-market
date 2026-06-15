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

**English** | [简体中文](./testnet-deployment.zh.md)

# X-Market Sui — Testnet Deployment Guide

> **Environment:** Sui Testnet · **On-chain config:** [deploy/testnet-v2.json](../deploy/testnet-v2.json)  
> **Package v3:** `0x2e368e…ae6e` (`unlock_price=0` free Commit fixed)  
> **Ubuntu 24 deployment:** see [testnet-deployment-ubuntu.md](./testnet-deployment-ubuntu.md)

This document covers the full **local/test machine** deployment: frontend, off-chain services (P0–P1), Indexer (P2), Pricing Engine (P3), Prophet Audit Keeper (P4 optional).

---

## 1. Architecture Overview

```
Browser (localhost:3000)
    │
    ├── Sui RPC (Testnet) ──────────────► On-chain contracts v3
    ├── Gas Station (:8787) ────────────► Sponsor Prophet PTB
    ├── Walrus Relay (:8791) ─────────► PUT /v1/blobs → Walrus Publisher
    ├── Indexer API (:8800) ──────────► PostgreSQL (:5432)
    └── Pricing Engine (:8801) ───────► Trade preview quotes

Background Keeper / Monitor
    ├── LP Guard Keeper (:8788)
    ├── Chain Monitor (:8789)
    ├── Oracle Relayer (:8790)
    └── Prophet Audit Keeper (:8792, optional)
```

---

## 2. Prerequisites

| Tool | Recommended Version | Purpose |
|------|----------|------|
| **Node.js** | ≥ 20 | Frontend + off-chain services |
| **npm** | ≥ 10 | Dependency install |
| **Sui CLI** | Latest testnet | Export deployer keys, faucet, on-chain ops |
| **Docker Desktop** | Optional | Postgres for P2 Indexer (recommended) |
| **Git** | — | Clone repo |

### 2.1 Sui Wallet

Off-chain services (Gas Station, LP Guard Keeper, etc.) require the **deployer address** private key, and that address must be the seed pool `authority`:

```
Deployer: 0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07
```

```powershell
# Switch to testnet and import/activate deployer
sui client switch --env testnet
sui client active-address   # should match deployer in deploy/testnet-v2.json

# If Gas is insufficient
.\scripts\fund-gas-payer-testnet.ps1
.\scripts\check-gas-balances.ps1
```

> **Note:** If you use a non-deployer wallet, Gas Station can still sponsor some transactions, but LP Guard Keeper **cannot** update pool parameters (authority mismatch).

### 2.2 Port Usage

| Port | Service |
|------|------|
| 3000 | Next.js frontend |
| 5432 | PostgreSQL |
| 8787–8792 | Off-chain services |
| 8800 | Indexer API |
| 8801 | Pricing Engine |

---

## 3. Deployment Profiles

| Profile | Components | Typical Use |
|---------|----------|----------|
| `frontend` | Frontend env + npm only | UI only, direct RPC |
| `p0` | Gas Station + LP Guard | Prophet free Commit, LP defense |
| `p1` | P0 + Monitor + Oracle Relayer + Walrus Relay | **Recommended default** |
| `p2` | P1 + Postgres + Indexer | Home discovery, leaderboard, IV curve |
| `full` | P2 + Pricing Engine + Prophet Audit Keeper | Full test stack |

---

## 4. One-click Deployment (Recommended)

Run from repo root:

```powershell
# Default: P1 profile (Gas Station + Keeper + Monitor + Relayer + Walrus Relay)
.\scripts\deploy-testnet.ps1

# Frontend only
.\scripts\deploy-testnet.ps1 -Profile frontend

# With Indexer (auto-starts Docker Postgres)
.\scripts\deploy-testnet.ps1 -Profile p2

# Full stack
.\scripts\deploy-testnet.ps1 -Profile full

# First run: observe Keeper logs, no on-chain tx
.\scripts\deploy-testnet.ps1 -DryRunKeeper

# Skip env generation (already bootstrapped)
.\scripts\deploy-testnet.ps1 -SkipBootstrap
```

### 4.1 Start Frontend

The deploy script **does not** block on Next.js; open another terminal:

```powershell
cd app
npm install
npm run dev
# → http://localhost:3000
```

Connect a **Testnet wallet** in the browser (must hold test USDC; mint on market page or `.\scripts\mint-test-usdc.ps1`).

### 4.2 Verification

```powershell
.\scripts\verify-testnet-deployment.ps1 -Profile p1
.\scripts\verify-testnet-deployment.ps1 -Profile p2
```

### 4.3 Stop

```powershell
.\scripts\stop-testnet.ps1              # stop all
.\scripts\stop-testnet.ps1 -Profile p1  # stop P1 and below only
```

---

## 5. Step-by-step Manual Deployment

For troubleshooting, follow this order.

### 5.1 Generate Environment Variables

```powershell
# Off-chain services + app/.env.local (includes Gas Station / Walrus Relay URL)
.\scripts\bootstrap-services-env.ps1

# Optional: Keeper logs only, no on-chain tx
.\scripts\bootstrap-services-env.ps1 -DryRunKeeper

# Indexer (P2+)
.\scripts\bootstrap-indexer-env.ps1
```

Generated `.env.local` files (**do not commit to git**):

| Path | Description |
|------|------|
| `services/gas-station/.env.local` | Gas Payer key, Package ID |
| `services/lp-guard-keeper/.env.local` | Keeper key, pool ID list |
| `services/chain-monitor/.env.local` | Monitoring + alert webhook |
| `services/oracle-relayer/.env.local` | Oracle expiry scan |
| `services/walrus-relay/.env.local` | Walrus upload proxy |
| `services/prophet-audit-keeper/.env.local` | Audit Keeper (default DRY_RUN) |
| `services/indexer/.env.local` | Postgres connection string |
| `app/.env.local` | Frontend on-chain IDs + local service URLs |

### 5.2 Off-chain Services (P0 / P1)

```powershell
.\scripts\start-services-testnet.ps1           # P0 + P1
.\scripts\start-services-testnet.ps1 -P0Only   # Gas Station + Keeper only
.\scripts\start-services-testnet.ps1 -IncludeP4  # includes Prophet Audit Keeper

.\scripts\verify-services-health.ps1 -IncludeP1
```

### 5.3 Indexer + PostgreSQL (P2)

**Option A — Docker (recommended)**

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
```

**Option B — Local PostgreSQL**

```powershell
.\scripts\bootstrap-local-postgres.ps1   # requires psql + postgres superuser
.\scripts\start-indexer.ps1
```

### 5.4 Pricing Engine (P3)

```powershell
.\scripts\start-pricing-engine.ps1
# GET http://localhost:8801/health
```

### 5.5 Docker Compose All Services (Optional)

```powershell
.\scripts\bootstrap-services-env.ps1
docker compose -f docker-compose.services.yml up -d --build
.\scripts\verify-services-health.ps1 -IncludeP1
```

Indexer full container:

```powershell
docker compose -f docker-compose.indexer.yml --profile full up -d --build
```

---

## 6. On-chain Resources (Testnet v3)

Full IDs in [deploy/testnet-v2.json](../deploy/testnet-v2.json).

| Resource | ID |
|------|-----|
| Package v3 | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| GlobalConfig | `0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08` |
| Prophet Registry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |
| Oracle Config | `0x1ad185d06bcbb53a98c5a834516da7a28c748f32079faa8ff310a35d04f663d8` |
| Poisson pool | `0xb5d1a85213d6757d1cb386e8b719b524162a117018e6f5b8f0101f4dcc532b5f` |
| Dirichlet pool | `0x89fb5ff5754fe5b2d32d071ce98ad778b62a48f738e0d7dd27a86b390eddaac5` |
| Normal pool | `0xa43716a746c01d6039cd7b9e6a77562f17a8730dc72c9363ddfde06859e4f834` |

**Republish on-chain contracts** (usually not needed; only when forking a new environment):

```powershell
.\scripts\deploy-oracle-prophet-testnet.ps1   # fresh publish
.\scripts\upgrade-testnet.ps1                 # upgrade existing package
```

---

## 7. Acceptance Checklist

### P0 / P1

- [ ] `GET http://localhost:8787/health` → `ok: true`
- [ ] `GET http://localhost:8788/health` → `ok: true`
- [ ] `GET http://localhost:8791/health` → `ok: true`
- [ ] Gas Payer SUI balance sufficient (`check-gas-balances.ps1`)
- [ ] `/prophet` page `unlock_price=0` free Commit works via Gas Station
- [ ] `.run/lp-guard-keeper.log` shows `lp_guard_tick` (when `LP_GUARD_DRY_RUN=false`)

### P2

- [ ] `GET http://localhost:8800/health` → `ok: true`
- [ ] `GET http://localhost:8800/v1/markets` returns seed markets
- [ ] Home MarketsGrid, leaderboard, IV panel have Indexer data

### P3

- [ ] `GET http://localhost:8801/health` → `ok: true`
- [ ] Market page TradePanel shows pricing preview

### End-to-end Drill

```powershell
.\scripts\run-p0-drills-testnet.ps1
# Manual E/F items: docs/p0-drill-ef-checklist.md
```

---

## 8. Logs & Troubleshooting

| Log | Path |
|------|------|
| Off-chain services | `.run/<service-name>.log` |
| Indexer | `.run/indexer.log` |
| Pricing Engine | `.run/pricing-engine.log` |
| PID files | `.run/*.pid` |

### Common Issues

**`bootstrap-services-env.ps1` key export fails**  
→ Confirm `sui client active-address` matches deployer and keystore is accessible.

**Gas Station `/health` reports low balance**  
→ `.\scripts\fund-gas-payer-testnet.ps1`

**Prophet blob upload fails**  
→ Confirm Indexer is running (`:8800/health`); `NEXT_PUBLIC_INDEXER_URL=http://localhost:8800`; Prophet uses `POST /v1/prophecies/blob`

**Indexer Postgres connection fails**  
→ `docker compose -f docker-compose.indexer.yml ps` check postgres healthy; or use `bootstrap-local-postgres.ps1`

**Keeper authority mismatch**  
→ Must use deployer wallet; or update `deploy/testnet-v2.json` and re-bootstrap

**Port in use**  
→ `.\scripts\stop-testnet.ps1` then retry

---

## 9. Related Docs

| Doc | Content |
|------|------|
| [services-testnet-runbook.md](./services-testnet-runbook.md) | P0 service details |
| [p1-services-runbook.md](./p1-services-runbook.md) | Monitor / Relayer / Walrus Relay |
| [p2-indexer-runbook.md](./p2-indexer-runbook.md) | Indexer API and tables |
| [p3-growth-runbook.md](./p3-growth-runbook.md) | Pricing Engine |
| [prophet-playbook.md](./prophet-playbook.md) | Prophet / Seal / Indexer blob flow |
| [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) | Frontend E2E acceptance |

---

## 10. Script Index

| Script | Description |
|------|------|
| `deploy-testnet.ps1` | **One-click deploy** (Windows, by profile) |
| `deploy-testnet.sh` | **One-click deploy** (Ubuntu/Linux) |
| `stop-testnet.ps1` / `stop-testnet.sh` | **One-click stop** |
| `verify-testnet-deployment.ps1` / `.sh` | **Post-deploy verification** |
| `install-ubuntu-prerequisites.sh` | Ubuntu 24 dependency install |
| `bootstrap-services-env.ps1` / `.sh` | Generate off-chain service env |
| `bootstrap-indexer-env.ps1` / `.sh` | Generate Indexer env |
| `start-services-testnet.ps1` / `.sh` | Start P0/P1 services |
| `start-indexer.ps1` / `.sh` | Start Indexer |
| `start-pricing-engine.ps1` / `.sh` | Start Pricing Engine |
| `verify-services-health.ps1` / `.sh` | Off-chain service health check |
| `verify-indexer-health.ps1` / `.sh` | Indexer health check |
| `fund-gas-payer-testnet.ps1` / `.sh` | Testnet faucet |
| `check-gas-balances.ps1` | Gas balance check |

Full Linux guide: [testnet-deployment-ubuntu.md](./testnet-deployment-ubuntu.md).
