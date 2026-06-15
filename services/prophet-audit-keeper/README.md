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

# Prophet Audit Keeper

**English** | [简体中文](./README.zh.md)

PRD §11.3.4 · P4.1 — Automatically submits `audit_prophecy` after Oracle settlement.

## Flow

```
Pool resolved + now >= lock_time + prophecy.status == OPEN
  → Indexer/IPFS blob → Seal decrypt (or plaintext cache)
  → audit_prophecy (hash check → track record → revenue split)
```

## Environment

```powershell
.\scripts\bootstrap-services-env.ps1   # generates .env.local
# Or separately: services/prophet-audit-keeper/.env.example
```

| Variable | Description |
|------|------|
| `PROPHET_AUDIT_POOL_IDS` | Seed pool ID list |
| `PROPHET_REGISTRY_ID` | ProphetRegistry |
| `PROPHET_AUDIT_DRY_RUN` | Default `true` |
| `INDEXER_URL` | Read blob + `/v1/prophecies/:id/plaintext` cache |
| `IPFS_GATEWAY_URL` | Resolve `ipfs:` blobs |

## Run

```powershell
cd services/prophet-audit-keeper
npm install
npm run dev
# GET http://localhost:8792/health
```

Gas Station allowlist includes `audit_prophecy`; the keeper may also pay SUI directly.
