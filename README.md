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

# X-Market on Sui

**English** | [简体中文](./README.zh.md)

**Sui prediction market product suite** — Move on-chain modules + Circle native `USDC` Vault + parametric AMM + SuiProphet paid knowledge ecosystem.

No shared contracts, liquidity, or deployments with [X-Market on Solana](../x-market-solana); only product vision and math spec are shared.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Application: Next.js Web · Flutter Mobile · Gas Station · Indexer │
├─────────────────────────────────────────────────────────────────┤
│  Business Modules                                                │
│  ┌──────────────────────┐    ┌────────────────────────────┐    │
│  │ X-Market (Trading)    │    │ SuiProphet (Paid Insights)  │    │
│  │ MarketPool · Position │    │ PrivateProphecy · Leaderboard│   │
│  └──────────┬───────────┘    └─────────────┬──────────────┘    │
│             └──────────────┬─────────────────┘                    │
│                            ▼                                    │
│              EventRoot / MarketPool (market root · shared)       │
├─────────────────────────────────────────────────────────────────┤
│  Unified On-Chain Event Engine (Oracle)                          │
│  macro_oracle · oracle_arbitrator · DataFeed · committee finality│
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Directory | Description |
| --- | --- | --- |
| On-chain contracts | `sources/` | Move modules: AMM, Oracle, Prophet, LP, margin, etc. |
| Web frontend | `app/` | Next.js 15 + `@mysten/dapp-kit` |
| Mobile | `mobile/x_market_flutter/` | Flutter + Rust pricing bridge |
| Off-chain services | `services/` | Gas Station, Indexer, LP Guard, Oracle Relayer, etc. |
| Pricing engine | `pricing-engine/` | Off-chain preview (aligned with `math-spec`) |
| Math spec | `math-spec/` | Q32.32 fixed-point spec and test vectors |
| Deployment | `scripts/`、`deploy/` | Testnet seed markets, service bootstrap |

## Repository Structure

```
x-market-sui/
├── sources/                  # Move on-chain modules
├── math-spec/                # Math spec and LUT generation scripts
├── app/                      # Next.js web frontend
├── mobile/x_market_flutter/  # Flutter mobile client
├── services/
│   ├── indexer/              # PostgreSQL on-chain indexer + REST API
│   ├── gas-station/          # Gas sponsorship (Prophet whitelist PTBs)
│   ├── lp-guard-keeper/      # LP dynamic fee adjustment
│   ├── chain-monitor/        # Service health aggregation
│   ├── oracle-relayer/       # Oracle proposal relay
│   ├── walrus-relay/         # Walrus storage relay
│   ├── prophet-audit-keeper/ # Prophet audit keeper
│   ├── uma-dvm-relayer/      # UMA DVM relay
│   └── brevis-zk-prover/     # ZK coprocessor proofs
├── pricing-engine/           # Off-chain pricing preview
├── faucet/                   # Testnet USDC faucet (optional)
├── deploy/                   # Testnet / Mainnet deployment records
├── scripts/                  # PowerShell / Bash ops scripts
├── docs/                     # Runbooks, playbooks, FAQ
├── docker-compose.services.yml
├── docker-compose.indexer.yml
├── Move.toml
└── PRD.md
```

## Prerequisites

| Component | Version / Tools |
| --- | --- |
| On-chain dev | [Sui CLI](https://docs.sui.io/guides/developer/getting-started) (Move 2024.beta) |
| Web frontend | Node.js 20+, npm |
| Off-chain services | Node.js 20+, Docker (PostgreSQL) |
| Mobile | Flutter 3.x, Rust toolchain (`flutter_rust_bridge`) |
| Math LUT | Python 3.10+ |

## Quick Start

### 1. On-Chain Contracts

```powershell
# Generate exp lookup table (first run or after math-spec changes)
python math-spec/scripts/gen_exp_neg_lut.py

# Unit tests and build
sui move test
sui move build

# Publish to Testnet (requires configured sui client)
sui client publish --gas-budget 500000000
# Full record: deploy/testnet-v2.json
```

### 2. Web Frontend

```powershell
cd app
cp .env.example .env.local   # Fill in Testnet package / service URLs
npm install
npm run dev                  # http://localhost:3000
```

Key routes: `/markets` market list · `/lp` LP panel · `/positions` positions · `/prophet` prophets · `/leaderboard` leaderboard

### 3. Off-Chain Services (P0 / P1)

```powershell
# Generate .env.local from deploy/testnet-v2.json
.\scripts\bootstrap-services-env.ps1

# Start local processes
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1

# Or use Docker
docker compose -f docker-compose.services.yml up -d --build
```

| Service | Port | Description |
| --- | --- | --- |
| Gas Station | 8787 | Gas sponsorship for free Prophet commits |
| LP Guard Keeper | 8788 | Dynamic fee tuning for seed pools |
| Chain Monitor | 8789 | Service health aggregation |
| Oracle Relayer | 8790 | Oracle proposal relay |
| Walrus Relay | 8791 | Walrus storage relay |

See [docs/services-testnet-runbook.md](./docs/services-testnet-runbook.md) and each service README for details.

### 4. Indexer (P2)

```powershell
# Start PostgreSQL
docker compose -f docker-compose.indexer.yml up -d postgres

# Configure and start Indexer
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
# API default: http://localhost:8800
```

See [services/indexer/README.md](./services/indexer/README.md) and [docs/p2-indexer-runbook.md](./docs/p2-indexer-runbook.md).

### 5. Pricing Engine

```powershell
cd pricing-engine
npm install
npm start                    # http://localhost:8801
```

### 6. Mobile (Flutter)

```powershell
cd mobile/x_market_flutter
.\scripts\bootstrap-mobile-env.ps1   # Run from repo root
flutter pub get
flutter run
```

See [mobile/x_market_flutter/README.md](./mobile/x_market_flutter/README.md).

### 7. Testnet Seed Markets

```powershell
.\scripts\seed-testnet.ps1           # Create Poisson / Dirichlet / Normal seed pools
.\scripts\start-auction-pool.ps1 -Kind poisson   # Create a new auction pool
```

## Testnet Deployment (v2, current)

Full record: [deploy/testnet-v2.json](./deploy/testnet-v2.json).

| Resource | ID |
| --- | --- |
| Package | `0x083d470a44ce73a290368ec18a8ee96c49cc3491e29117737e62c9f57dbec57d` |
| GlobalConfig | `0x55d3205160a04f43eabcc3ee1dadd8cc39a071e0791cda00af3dd96258fe1111` |
| AdminCap | `0x5560450916bf31807ab5b3a389d9895c92d18de68e770ebe598ca3aa3f3ed528` |
| OracleConfig | `0x4d3e154b88aae952099c91bbb28c50c49140a3954d223f9c84570722b7a39f8a` |
| ProphetRegistry | `0x1f654bad17271115bebd91e92639a0f80157539779192022ffb1d959a5f115c3` |
| Poisson pool | `0x075799eb6efda59c1834d8e70338cb11c9dc56c567c5ddb113a742ff419cc0d5` |
| Dirichlet pool | `0x296c749d8257d68a31a1da3b715ccb01acfabb85112e5cc9885755818b3dcd5e` |
| Normal pool | `0x407cbfcbab839d1fd192bf694d582c7cc1686b3ec7aed1b4e6f19335bb98cf91` |

Explorer: [Suivision Package](https://testnet.suivision.xyz/package/0x083d470a44ce73a290368ec18a8ee96c49cc3491e29117737e62c9f57dbec57d)

> Legacy deployment: `deploy/testnet.json` (superseded).

### USDC (Circle Native)

The protocol uses **Circle native USDC** (not a custom test token):

| Network | Coin Type |
| --- | --- |
| Testnet | `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC` |
| Mainnet | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` |

1. **Get Testnet USDC**: [Circle Testnet docs](https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui), or `.\scripts\transfer-test-usdc.ps1 -Recipient 0x…`
2. **Buy**: Connect wallet → pick interval/digital option → "Buy with USDC" (gas paid in SUI)
3. **Positions**: View on `/positions`; claim payout after settlement

## Core Capabilities

### X-Market Trading Module

| Capability | Status |
| --- | --- |
| Tier 1: Poisson / Dirichlet / Normal | ✅ |
| Interval + digital options | ✅ `buy_*_interval` / `buy_*_digital` |
| USDC Vault + Max-Loss | ✅ |
| Opening Auction → Trading → Settled | ✅ |
| NAV deposit / LP Token | ✅ `deposit_liquidity` + `LpShare` |
| Oracle settlement (optimistic + dispute + finality) | ✅ `macro_oracle` + `settlement` |
| Cross margin | ✅ `cross_margin` |
| LP Guard dynamic fees | ✅ `lp_guard` + Keeper |

### SuiProphet Paid Module

| Capability | Status |
| --- | --- |
| Private prophecy commit (Seal encryption) | ✅ `prophet_registry` |
| Track record / Prophet Score | ✅ `prophet_leaderboard` |
| Leaderboard (on-chain + Indexer) | ✅ `/leaderboard` |
| Gas Station free commit sponsorship | ✅ |
| EventRoot market root abstraction | ✅ `event_root` (migration in progress) |

## Vault

USDC is held in the shared object `MarketPool.vault: Balance<USDC>`. Settlement and payouts flow through the Vault, constrained by Max-Loss.

## Documentation Index

### Product & Spec

- [PRD.md](./PRD.md) — Product requirements
- [math-spec/SPEC.md](./math-spec/SPEC.md) — Tier 1 on-chain math spec
- [docs/business-spec.md](./docs/business-spec.md) — Business specification
- [docs/glossary.md](./docs/glossary.md) — System glossary
- [docs/qa.md](./docs/qa.md) — Q&A
- [docs/faq-public.md](./docs/faq-public.md) — Public FAQ

### Phase Playbooks

- [docs/phase1.5-playbook.md](./docs/phase1.5-playbook.md)
- [docs/phase2-playbook.md](./docs/phase2-playbook.md)
- [docs/phase3-playbook.md](./docs/phase3-playbook.md)
- [docs/phase4-services.md](./docs/phase4-services.md)

### Operations Runbooks

- [docs/services-testnet-runbook.md](./docs/services-testnet-runbook.md) — P0/P1 off-chain services
- [docs/p1-services-runbook.md](./docs/p1-services-runbook.md)
- [docs/p2-indexer-runbook.md](./docs/p2-indexer-runbook.md) — Indexer
- [docs/p3-growth-runbook.md](./docs/p3-growth-runbook.md)
- [docs/p4-scale-runbook.md](./docs/p4-scale-runbook.md)
- [docs/testnet-deployment.md](./docs/testnet-deployment.md)
- [docs/testnet-deployment-ubuntu.md](./docs/testnet-deployment-ubuntu.md)

### Oracle & Prophet

- [docs/oracle-playbook.md](./docs/oracle-playbook.md)
- [docs/prophet-playbook.md](./docs/prophet-playbook.md)
- [docs/prophet-market-and-encryption-guide.md](./docs/prophet-market-and-encryption-guide.md)
- [Macro_Data_Oracle.md](./Macro_Data_Oracle.md)
- [SuiProphet_Network.md](./SuiProphet_Network.md)

### Mainnet Readiness

- [docs/mainnet-readiness-checklist.md](./docs/mainnet-readiness-checklist.md)
- [docs/mainnet-infra-priority.md](./docs/mainnet-infra-priority.md)
- [docs/mainnet-governance-params.md](./docs/mainnet-governance-params.md)
- [docs/governance-params-signoff.md](./docs/governance-params-signoff.md)

### Other

- [docs/tier2-decision.md](./docs/tier2-decision.md)
- [docs/slash-and-attestation.md](./docs/slash-and-attestation.md)
- [docs/deferred-features.md](./docs/deferred-features.md)
- [docs/gas-station-implementation.md](./docs/gas-station-implementation.md)
- [docs/demo-walkthrough.md](./docs/demo-walkthrough.md)

## License

This project is licensed under the [Business Source License 1.1 (BSL 1.1)](./LICENSE). Change Date: **2031-01-01** — after which it automatically converts to Apache License 2.0.
