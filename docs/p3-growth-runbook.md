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

# P3 增长期 Runbook

## 3.1 订阅者 ROI

- **表：** `buyer_roi` + `buyer_roi_summary`
- **API：** `GET /v1/buyer-roi?buyer=` · `GET /v1/buyer-roi/summary?buyer=`
- **前端：** `/roi`（需 `NEXT_PUBLIC_INDEXER_URL`）

## 3.2 Pricing Engine / SDK

```powershell
cd pricing-engine && npm install && npm start
# → http://localhost:8801/v1/quote?kind=poisson&stake_usdc=1000000&...
```

- **SDK：** `pricing-engine/src/index.ts` → `quoteBuy()`
- **前端：** `TradePanel` 定价预览 · `NEXT_PUBLIC_PRICING_ENGINE_URL`

## 3.3 Seal 明文缓存

Indexer `seal-cache` worker：当 `lock_time` 已过或 `is_public`，从 Indexer/IPFS blob 拉取明文写入 `seal_plaintext_cache`。

```
GET /v1/prophecies/:prophecyId/plaintext
```

环境：`INDEXER_PROPHET_BLOBS_DIR` · `IPFS_GATEWAY_URL`

## 3.4 GeoBlock

```env
GEO_BLOCK_ENABLED=true
GEO_BLOCKED_COUNTRIES=US,CN
```

依赖边缘 `x-vercel-ip-country` / `cf-ipcountry`。被拦截用户见 `/blocked`。

详见 [compliance-geoblock.md](./compliance-geoblock.md)。

## 3.5 移动端主网配置

```powershell
.\scripts\bootstrap-mobile-env.ps1 -Network testnet
# 主网发包后：
.\scripts\bootstrap-mobile-env.ps1 -Network mainnet -DeployJson deploy/mainnet.json
cd mobile/x_market_flutter && flutter run
```

`SuiConfig` 含 `network`、`rpcUrl`、`packageId`、种子池、Indexer/Gas Station URL。Phantom deeplink 使用 `SuiConfig.network`。

## 验证

```powershell
.\scripts\verify-p3-readiness.ps1
```
