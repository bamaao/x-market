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

**English** | [简体中文](./p4-scale-runbook.zh.md)

# P4 SuiProphet Scale Runbook

> Phase 4 production loop: audit Keeper, EventRoot index, frontend closed loop, GMV ops metrics.

## 4.1 Prophet Audit Keeper

Automatically submits `audit_prophecy` after Oracle settlement (hash → stats → revenue split).

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
# GET http://localhost:8792/health
```

| Variable | Description |
|------|------|
| `PROPHET_AUDIT_DRY_RUN` | Default `true`; set `false` after integration passes |
| `INDEXER_URL` | Prefer plaintext cache reads |
| `PROPHET_AUDIT_POOL_IDS` | Seed pool list |

## 4.2 EventRoot Index

- **Table:** `event_roots`
- **API:** `GET /v1/event-roots` · `GET /v1/event-roots/:id`
- **Seed:** `deploy/testnet-v2.json` → `eventRoots`

## 4.3 Prophet Frontend Closed Loop

- Prophecy list: Indexer `/v1/prophecies` first
- Decryption: `decryptFromIndexerCache` → Seal fallback
- EventRoot navigation: `EVENT_ROOT_BY_POOL` + Indexer `event_root_id`

## 4.4 Prophet GMV Metrics

- **Table:** `prophet_gmv_daily` (unlock GMV + audit volume)
- **API:** `GET /v1/metrics/prophet-gmv?days=30`
- **Frontend:** `/metrics`

## Local Postgres (No Docker)

```powershell
.\scripts\bootstrap-local-postgres.ps1   # one-time DB setup
.\scripts\start-indexer.ps1
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
.\scripts\verify-p4-e2e-local.ps1
```

## Verification

```powershell
.\scripts\verify-p4-readiness.ps1
.\scripts\verify-p4-e2e-local.ps1
.\scripts\verify-p3-readiness.ps1
```

## Service Ports

| Service | Port |
|------|------|
| prophet-audit-keeper | 8792 |
