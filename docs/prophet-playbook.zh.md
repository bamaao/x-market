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

**简体中文** | [English](./prophet-playbook.md)

# SuiProphet Playbook

知识付费预言模块（PRD §11）。共用 L0 Oracle 结算，不另建 Feed。

> **操作指南：** 创建市场 + 公开/加密预测全流程见 [prophet-market-and-encryption-guide.md](./prophet-market-and-encryption-guide.md)。

## 架构

**公开（`unlock_price=0`）**

```
canonical JSON 明文 → Indexer /v1/prophecies/blob → Commit（链上存 predicted_* + hash(JSON)）
```

**付费（`unlock_price>0`）**

```
ProphecyPayload → BCS（prophet_plain）→ Seal.encrypt(seal_id) → Indexer blob → Commit（链上 predicted_*=0，hash(BCS)）
                    ↓
         seal_approve_prophecy (OR: paid | lock_time | public)
                    ↓
         Seal.decrypt → BCS 解码 → 展示数字 + 分析
                    ↓
         audit_prophecy(BCS bytes) → reveal 链上 predicted_* + 战绩
```

链上 `blob_id` 格式：

| 前缀 | 存储 |
| --- | --- |
| `idx:` | Indexer 本地磁盘（`INDEXER_PROPHET_STORAGE=local`） |
| `ipfs:` | IPFS Pin（`INDEXER_PROPHET_STORAGE=ipfs`） |

## 部署

### 1. 创建 ProphetRegistry

```bash
sui client call --package $PKG --module prophet_registry --function create_prophet_registry \
  --args $GLOBAL_CONFIG $ADMIN_CAP 500
```

### 2. 环境变量（`app/.env`）

```
NEXT_PUBLIC_PROPHET_REGISTRY_ID=0x...
NEXT_PUBLIC_INDEXER_URL=http://localhost:8800
NEXT_PUBLIC_SEAL_THRESHOLD=1
# INDEXER_PROPHET_STORAGE=ipfs 时：
# NEXT_PUBLIC_IPFS_GATEWAY_URL=https://w3s.link
```

Indexer（`services/indexer/.env`）：

```
INDEXER_PROPHET_STORAGE=local
# INDEXER_PROPHET_BLOBS_DIR=data/prophecy-blobs
# IPFS_PINATA_JWT=...   # ipfs 模式
```

Seal Testnet 密钥服务器（配置于 `app/src/lib/seal-prophet.ts` → `SEAL_KEY_SERVERS`）：

| 名称 | Object ID |
| --- | --- |
| mysten-testnet-1 | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` |
| mysten-testnet-2 | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` |

**注意：** 重新部署 Move 包后须用新 `PACKAGE_ID` 加密；旧密文无法被新 `seal_approve` 策略解密。

## 预言家 Commit

### 公开练手（`unlock_price = 0`）

1. 构造 canonical JSON（`market_id`, `predicted_value`, `analysis_content`, 可选区间）
2. `POST $INDEXER/v1/prophecies/blob?pool_id=...` 上传 **明文**
3. `commit_private_prophecy(..., predicted_* = 真实值, plaintext_hash = blake2b256(JSON), seal_id = [])`

### 加密付费（`unlock_price > 0`）

1. 生成 `seal_id`（32 字节随机）
2. `BCS encode` → `SealClient.encrypt({ packageId, id: hex(seal_id), data: bcsBytes })`
3. `POST $INDEXER/v1/prophecies/blob?pool_id=...` 上传密文
4. `commit_private_prophecy(..., predicted_* = 0, plaintext_hash = blake2b256(BCS), prediction_revealed = false)`

链上：`lock_time` = Pool `maturity_ts`。

本地仍保存 **JSON**（供 UI 审计表单）；提交 audit 时前端/Keeper 将 JSON 重新编码为 BCS 字节。

## 订阅者解锁 + 解密

1. `unlock_prophecy` 支付 USDC → `paid_buyers`（Seal **条件 A**）
2. 钱包签署 `SessionKey`（30 分钟 TTL）
3. PTB 仅调用 `seal_approve_prophecy(seal_id, prophecy, clock)`（dry-run 验证）
4. `SealClient.decrypt` + `GET $INDEXER/v1/prophecies/blobs/{filename}` 或 IPFS gateway

## Web 全流程（`/prophet`）

| 步骤 | 操作 | 说明 |
| --- | --- | --- |
| 1. Commit | 预言家填写预测 + 分析 | 公开：JSON 明文；付费：BCS + Seal → `predicted_*=0`；本地存 JSON 供审计 |
| 2. 解锁 | 订阅者支付 USDC | `unlock_prophecy`；成功后页面自动尝试 Seal 解密 |
| 3. 解密 | Indexer/IPFS GET + Seal | 付费解密 BCS；须满足 `paid_buyers` ∥ `lock_time` 后 ∥ `is_public` |
| 4. 审计 | Oracle 结算后 | `audit_prophecy`：公开传 JSON 字节，付费传 **BCS 字节** → hash 校验 → reveal 数字 → 战绩 → `is_public` |

关键前端模块：

- `app/src/lib/prophet.ts` — 工作流推导、`decryptProphecyContent`
- `app/src/lib/seal-prophet.ts` — Seal 1.x + SessionKey
- `app/src/lib/prophet-blob.ts` / `prophet-blob-upload.ts` — Indexer/IPFS 读写

双钱包 Testnet 验收：钱包 A Commit → 钱包 B Unlock（自动解密）→ Oracle 结算后 Audit。

## Seal OR 策略（`seal_approve_prophecy`）

| 条件 | 链上判定 |
| --- | --- |
| A 付费 | `sender ∈ paid_buyers` |
| B 公开 | `now > lock_time` 或 `is_public` |

## Oracle 审计 → 战绩 → 分账

前置：Pool 已 `resolved` 且 `now >= lock_time`（与 Oracle 页结算对齐，见 [oracle-playbook.md](./oracle-playbook.md)）。

`prophet-audit-keeper` 从 Indexer/IPFS 拉 blob → Seal 解密 → 按 `unlock_price` 构造 audit 字节（JSON 或 BCS）→ 提交 `audit_prophecy`。

## 模块

| 模块 | 说明 |
| --- | --- |
| `prophet_registry` | Commit / unlock / audit / reveal、`seal_approve_prophecy` |
| `prophet_plain` | 付费 BCS 明文结构与 hash |
| `prophet_leaderboard` | Prophet Score |
| `services/indexer` | `POST/GET /v1/prophecies/blob` |
| `app/src/lib/seal-prophet.ts` | Seal 加解密 |
| `app/src/lib/prophet-blob*.ts` | Indexer/IPFS blob 读写 |

## 待办

- [x] Prophet Audit Keeper（`services/prophet-audit-keeper/`）
