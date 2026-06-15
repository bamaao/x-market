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

**English** | [简体中文](./p2-indexer-runbook.zh.md)

# P2 Indexer Full Runbook

> Not MVP: Postgres persistence + multiple workers + REST API, covering P2.1–2.5 (P2.6 UMA DVM evaluation at end).

## Architecture

```
Sui RPC ──► Indexer Workers ──► PostgreSQL ──► REST API (:8800) ──► Next.js
              ├─ event-worker     prophecies, chain_events, arbitration
              ├─ snapshot-worker  pool_snapshots, iv_history, feeds
              └─ stats-worker     prophet_stats, prophet_stats_history, buyer_roi
```

## Tables

| Table | Purpose | P2 Item |
|----|------|-------|
| `markets` | Market discovery (replaces per-pool env) | 2.1 / 2.3 |
| `feeds` | Oracle DataFeed index | 2.3 |
| `prophecies` | Prophecy commit index | 2.4 |
| `prophet_stats` | Leaderboard cache | 2.4 |
| `prophet_stats_history` | Rank changes | 2.4 |
| `pool_snapshots` | Pool state time series | 2.1 |
| `iv_history` | Vol Crush curve | 2.2 |
| `arbitration_cases` | Dispute cases | 2.5 |
| `buyer_roi` | Subscriber ROI | 3.1 pre-provisioned |
| `chain_events` | Raw event audit | 2.1 |

## Startup (Testnet)

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
.\scripts\verify-p2-readiness.ps1
```

Frontend `app/.env.local`:

```
NEXT_PUBLIC_INDEXER_URL=http://localhost:8800
```

## REST API

| Endpoint | Description |
|------|------|
| `GET /health` | Service status and last sync time |
| `GET /v1/markets` | Market list (home discovery) |
| `GET /v1/markets/:poolId` | Single market |
| `GET /v1/feeds` | Feed list |
| `GET /v1/prophet/leaderboard?limit=50` | Leaderboard |
| `GET /v1/prophet/:addr/stats` | Individual stats |
| `GET /v1/prophet/:addr/history` | Score history |
| `GET /v1/prophecies?pool_id=&prophet=` | Prophecy index |
| `GET /v1/pools/:poolId/snapshots` | Pool snapshots |
| `GET /v1/pools/:poolId/iv-history` | IV / Vol Crush |
| `GET /v1/arbitration/cases?status=&pool_id=` | Dispute panel |
| `GET /v1/buyer-roi?buyer=` | Copy-trade ROI |
| `GET /v1/events?type=` | On-chain event audit |

## Frontend Integration

- Home `MarketsGrid`: Indexer → env fallback
- `/leaderboard`: Indexer leaderboard → RPC fallback
- `IvPanel`: Vol Crush bar chart (`iv_history`)

## Operations

- Logs: `.run/indexer.log`
- Migrations: auto-run on startup from `migrations/*.sql`
- Checkpoint: `indexer_checkpoints` table (event cursor)
- RPC: `SUI_RPC_URL` + `SUI_RPC_URL_FALLBACK`

## P2.6 UMA DVM Adapter (Implemented)

- Move: `create_uma_dvm_arbitrator` · `UmaDvmArbitrationRequested` · `execute_uma_dvm_arbitration`
- Relayer: `services/uma-dvm-relayer/` (`mock` / `live`)
- Indexer: `arbitration_cases.arbitration_adapter` (`builtin` | `uma_dvm`), migration `004_uma_dvm.sql`
- Script: `scripts/init-uma-dvm-arbitrator.ps1`

Dispute case API unchanged; frontend `/oracle` and `ArbitrationCasesPanel` show flow differences by adapter.
