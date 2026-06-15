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

**简体中文** | [English](./p4-scale-runbook.md)

# P4 SuiProphet 规模化 Runbook

> Phase 4 生产闭环：审计 Keeper、EventRoot 索引、前端闭环、GMV 运营指标。

## 4.1 Prophet Audit Keeper

自动在 Oracle 结算后提交 `audit_prophecy`（Hash → 战绩 → 分账）。

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
# GET http://localhost:8792/health
```

| 变量 | 说明 |
|------|------|
| `PROPHET_AUDIT_DRY_RUN` | 默认 `true`；联调通过后设 `false` |
| `INDEXER_URL` | 优先读明文缓存 |
| `PROPHET_AUDIT_POOL_IDS` | 种子池列表 |

## 4.2 EventRoot 索引

- **表：** `event_roots`
- **API：** `GET /v1/event-roots` · `GET /v1/event-roots/:id`
- **种子：** `deploy/testnet-v2.json` → `eventRoots`

## 4.3 Prophet 前端闭环

- 预言列表：Indexer `/v1/prophecies` 优先
- 解密：`decryptFromIndexerCache` → Seal 回退
- EventRoot 导航：`EVENT_ROOT_BY_POOL` + Indexer `event_root_id`

## 4.4 Prophet GMV 指标

- **表：** `prophet_gmv_daily`（解锁 GMV + 审计量）
- **API：** `GET /v1/metrics/prophet-gmv?days=30`
- **前端：** `/metrics`

## 本机 Postgres（无需 Docker）

```powershell
.\scripts\bootstrap-local-postgres.ps1   # 一次性建库
.\scripts\start-indexer.ps1
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
.\scripts\verify-p4-e2e-local.ps1
```

## 验证

```powershell
.\scripts\verify-p4-readiness.ps1
.\scripts\verify-p4-e2e-local.ps1
.\scripts\verify-p3-readiness.ps1
```

## 服务端口

| 服务 | 端口 |
|------|------|
| prophet-audit-keeper | 8792 |
