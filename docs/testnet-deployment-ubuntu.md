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

**English** | [简体中文](./testnet-deployment-ubuntu.zh.md)

# X-Market Sui — Testnet Deployment Guide (Ubuntu 24.04)

> **Target OS:** Ubuntu 24.04 LTS (other Debian/Ubuntu versions usually compatible)  
> **On-chain config:** [deploy/testnet-v2.json](../deploy/testnet-v2.json)  
> **Package v3:** `0x2e368e…ae6e` (`unlock_price=0` free Commit fixed)  
> **Windows deployment:** see [testnet-deployment.md](./testnet-deployment.md)

Full deployment on Ubuntu test machines: frontend, off-chain services (P0–P1), Indexer (P2), Pricing Engine (P3), Prophet Audit Keeper (P4 optional).

---

## 1. Architecture Overview

```
Browser (localhost:3000)
    │
    ├── Sui RPC (Testnet) ──────────────► On-chain contracts v3
    ├── LP Guard Keeper (:8788) ────────► Seed pool dynamic fees
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
| **Sui CLI** | Latest testnet | Export deployer keys, faucet |
| **Docker Engine** | Optional | Postgres for P2 Indexer (recommended) |
| **curl** | — | Health checks |
| **python3** | 3.12 (system default) | Parse deploy JSON |
| **Git** | — | Clone repo |

### 2.1 One-click Dependency Install

```bash
chmod +x scripts/*.sh scripts/lib/*.sh

# Base packages: Node 20, curl, git, python3, lsof
./scripts/install-ubuntu-prerequisites.sh

# With Docker + Sui CLI (recommended for first deploy)
./scripts/install-ubuntu-prerequisites.sh --with-docker --with-sui

# After Docker install, re-login or:
newgrp docker
```

### 2.2 Manual Install (Optional)

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

### 2.3 Sui Wallet

Off-chain services require **deployer address** private key (seed pool `authority`):

```
Deployer: 0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07
```

```bash
sui client switch --env testnet
sui client active-address   # should match deployer in deploy/testnet-v2.json

# If Gas is insufficient
./scripts/fund-gas-payer-testnet.sh
sui client gas
```

> LP Guard Keeper must match pool `authority`. Prophet uses wallet-paid SUI gas.

### 2.4 Ports

| Port | Service |
|------|------|
| 3000 | Next.js frontend |
| 5432 | PostgreSQL |
| 8788–8792 | Off-chain services |
| 8800 | Indexer API |
| 8801 | Pricing Engine |

Firewall (if exposing externally):

```bash
sudo ufw allow 3000/tcp   # frontend (dev)
sudo ufw allow 8788:8792/tcp
sudo ufw allow 8800:8801/tcp
```

---

## 3. Deployment Profiles

| Profile | Components | Typical Use |
|---------|----------|----------|
| `frontend` | Frontend env + npm only | UI only, direct RPC |
| `p0` | LP Guard | LP defense |
| `p1` | P0 + Monitor + Oracle Relayer + Walrus Relay | **Recommended default** |
| `p2` | P1 + Postgres + Indexer | Home discovery, leaderboard, IV curve |
| `full` | P2 + Pricing Engine + Prophet Audit Keeper | Full test stack |

---

## 4. One-click Deployment (Recommended)

```bash
git clone <your-repo> x-market-sui
cd x-market-sui
chmod +x scripts/*.sh scripts/lib/*.sh

# Default P1
./scripts/deploy-testnet.sh

# Frontend only
./scripts/deploy-testnet.sh --profile frontend

# With Indexer (auto docker compose postgres)
./scripts/deploy-testnet.sh --profile p2

# Full stack
./scripts/deploy-testnet.sh --profile full

# Keeper observe only, no on-chain tx
./scripts/deploy-testnet.sh --dry-run-keeper

# Skip env generation
./scripts/deploy-testnet.sh --skip-bootstrap
```

### 4.1 Start Frontend

```bash
cd app
npm run dev
# → http://localhost:3000
# Remote access: npm run dev -- -H 0.0.0.0
```

### 4.2 Verification & Stop

```bash
./scripts/verify-testnet-deployment.sh --profile p1
./scripts/stop-testnet.sh
./scripts/stop-testnet.sh --profile p2 --keep-postgres   # keep Postgres data
```

---

## 5. Step-by-step Manual Deployment

### 5.1 Generate Environment Variables

```bash
./scripts/bootstrap-services-env.sh
./scripts/bootstrap-services-env.sh --dry-run-keeper
./scripts/bootstrap-indexer-env.sh    # P2+
```

Generated files (**do not commit to git**):

| Path | Description |
|------|------|
| `services/lp-guard-keeper/.env.local` | Keeper key |
| `services/lp-guard-keeper/.env.local` | Keeper key, pool IDs |
| `services/chain-monitor/.env.local` | Monitoring |
| `services/oracle-relayer/.env.local` | Oracle scan |
| `services/walrus-relay/.env.local` | Walrus proxy |
| `services/prophet-audit-keeper/.env.local` | Audit Keeper |
| `services/indexer/.env.local` | Postgres connection |
| `app/.env.local` | Frontend config |

### 5.2 Off-chain Services

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

### 5.5 Docker Compose All Services

```bash
./scripts/bootstrap-services-env.sh
docker compose -f docker-compose.services.yml up -d --build
./scripts/verify-services-health.sh --include-p1
```

---

## 6. systemd Production (Optional)

For development, `nohup` + `.run/*.pid` is sufficient. For long-running hosts, write systemd units, e.g.:

```ini
# /etc/systemd/system/x-market-lp-guard.service
[Unit]
Description=X-Market LP Guard Keeper (Testnet)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/x-market-sui/services/lp-guard-keeper
EnvironmentFile=/opt/x-market-sui/services/lp-guard-keeper/.env.local
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now x-market-lp-guard
```

Duplicate for other services (lp-guard-keeper, walrus-relay, etc.) with different `WorkingDirectory` / `EnvironmentFile`.

---

## 7. On-chain Resources (Testnet v3)

| Resource | ID |
|------|-----|
| Package v3 | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| GlobalConfig | `0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08` |
| Prophet Registry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |

Full IDs in [deploy/testnet-v2.json](../deploy/testnet-v2.json).

---

## 8. Acceptance Checklist

```bash
# P1 health
curl -s http://localhost:8788/health | python3 -m json.tool
curl -s http://localhost:8791/health | python3 -m json.tool

# P2 Indexer
curl -s http://localhost:8800/v1/markets | python3 -m json.tool

# Logs
tail -f .run/lp-guard-keeper.log
tail -f .run/indexer.log
```

- [ ] Gas Payer SUI balance sufficient
- [ ] Demo wallet has enough SUI (Prophet self-paid gas)
- [ ] `/prophet` Commit / Unlock / Audit works
- [ ] Prophet Commit uploads blob via Indexer (`:8800`)
- [ ] Indexer `/v1/markets` has seed markets (P2+)

---

## 9. Troubleshooting

| Symptom | Fix |
|------|------|
| `Permission denied` running scripts | `chmod +x scripts/*.sh scripts/lib/*.sh` |
| `docker: permission denied` | `sudo usermod -aG docker $USER` then re-login |
| Key export fails | Confirm `sui client active-address` = deployer |
| Port in use | `./scripts/stop-testnet.sh` or `fuser -k 8788/tcp` |
| Indexer cannot connect to DB | `docker compose -f docker-compose.indexer.yml ps` |
| npm native module build fails | `sudo apt install build-essential` |

---

## 10. Script Index (Linux)

| Script | Description |
|------|------|
| `install-ubuntu-prerequisites.sh` | Install Node / optional Docker+Sui |
| `deploy-testnet.sh` | **One-click deploy** |
| `stop-testnet.sh` | **One-click stop** |
| `verify-testnet-deployment.sh` | Deploy verification |
| `bootstrap-services-env.sh` | Generate off-chain service env |
| `bootstrap-indexer-env.sh` | Generate Indexer env |
| `start-services-testnet.sh` | Start P0/P1 services |
| `start-indexer.sh` | Start Indexer |
| `start-pricing-engine.sh` | Start Pricing Engine |
| `fund-gas-payer-testnet.sh` | Testnet faucet |
| `lib/testnet-common.sh` | Shared functions |

Windows equivalents in [testnet-deployment.md](./testnet-deployment.md) (`*.ps1`).

---

## 11. Related Docs

- [services-testnet-runbook.md](./services-testnet-runbook.md)
- [p1-services-runbook.md](./p1-services-runbook.md)
- [p2-indexer-runbook.md](./p2-indexer-runbook.md)
- [prophet-playbook.md](./prophet-playbook.md)
