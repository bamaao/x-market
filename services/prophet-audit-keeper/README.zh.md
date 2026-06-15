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

**简体中文** | [English](./README.md)

PRD §11.3.4 · P4.1 — Oracle 结算后自动提交 `audit_prophecy`。

## 流程

```
池已 resolved + now >= lock_time + prophecy.status == OPEN
  → Indexer/IPFS blob → Seal 解密（或明文缓存）
  → audit_prophecy（Hash 校验 → 战绩 → 分账）
```

## 环境

```powershell
.\scripts\bootstrap-services-env.ps1   # 生成 .env.local
# 或单独：services/prophet-audit-keeper/.env.example
```

| 变量 | 说明 |
|------|------|
| `PROPHET_AUDIT_POOL_IDS` | 种子池 ID 列表 |
| `PROPHET_REGISTRY_ID` | ProphetRegistry |
| `PROPHET_AUDIT_DRY_RUN` | 默认 `true` |
| `INDEXER_URL` | 读 blob + `/v1/prophecies/:id/plaintext` 缓存 |
| `IPFS_GATEWAY_URL` | `ipfs:` blob 解析 |

## 运行

```powershell
cd services/prophet-audit-keeper
npm install
npm run dev
# GET http://localhost:8792/health
```

Gas Station 白名单已包含 `audit_prophecy`；Keeper 也可自付 SUI。
