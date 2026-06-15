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

**English** | [简体中文](./p3-growth-runbook.zh.md)

# P3 Growth Runbook

## 3.1 Subscriber ROI

- **Tables:** `buyer_roi` + `buyer_roi_summary`
- **API:** `GET /v1/buyer-roi?buyer=` · `GET /v1/buyer-roi/summary?buyer=`
- **Frontend:** `/roi` (requires `NEXT_PUBLIC_INDEXER_URL`)

## 3.2 Pricing Engine / SDK

```powershell
cd pricing-engine && npm install && npm start
# → http://localhost:8801/v1/quote?kind=poisson&stake_usdc=1000000&...
```

- **SDK:** `pricing-engine/src/index.ts` → `quoteBuy()`
- **Frontend:** `TradePanel` pricing preview · `NEXT_PUBLIC_PRICING_ENGINE_URL`

## 3.3 Seal Plaintext Cache

Indexer `seal-cache` worker: when `lock_time` has passed or `is_public`, fetch plaintext from Indexer/IPFS blob and write to `seal_plaintext_cache`.

```
GET /v1/prophecies/:prophecyId/plaintext
```

Env: `INDEXER_PROPHET_BLOBS_DIR` · `IPFS_GATEWAY_URL`

## 3.4 GeoBlock

```env
GEO_BLOCK_ENABLED=true
GEO_BLOCKED_COUNTRIES=US,CN
```

Depends on edge `x-vercel-ip-country` / `cf-ipcountry`. Blocked users see `/blocked`.

See [compliance-geoblock.md](./compliance-geoblock.md) for details.

## 3.5 Mobile Mainnet Config

```powershell
.\scripts\bootstrap-mobile-env.ps1 -Network testnet
# After mainnet publish:
.\scripts\bootstrap-mobile-env.ps1 -Network mainnet -DeployJson deploy/mainnet.json
cd mobile/x_market_flutter && flutter run
```

`SuiConfig` includes `network`, `rpcUrl`, `packageId`, seed pools, Indexer/Gas Station URL. Phantom deeplink uses `SuiConfig.network`.

## Verification

```powershell
.\scripts\verify-p3-readiness.ps1
```
