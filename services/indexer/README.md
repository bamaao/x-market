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

# X-Market Indexer (P2 Full)

**English** | [简体中文](./README.zh.md)

PostgreSQL on-chain indexer + REST API covering market discovery, Prophet leaderboards, IV curves, dispute cases, and subscriber ROI.

## Quick Start

```powershell
# 1. Postgres (Docker)
docker compose -f docker-compose.indexer.yml up -d postgres

# 2. Configure + start
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
```

## Environment Variables

See `.env.example`. Key settings:

- `INDEXER_DATABASE_URL` — PostgreSQL connection string
- `X_MARKET_PACKAGE_ID` / `PROPHET_REGISTRY_ID` / `ORACLE_CONFIG_ID`
- `SEED_DEPLOY_JSON` — seed market bootstrap

## API

Default `http://localhost:8800` — full endpoint list in [docs/p2-indexer-runbook.md](../../docs/p2-indexer-runbook.md).

## Workers

| Worker | Interval | Responsibility |
|--------|------|------|
| event | 15s | ProphecyCommitted, ArbitrationCaseOpened |
| snapshot | 60s | Pool state, feeds, iv_history |
| stats | 120s | prophet_stats, buyer_roi, case refresh |
