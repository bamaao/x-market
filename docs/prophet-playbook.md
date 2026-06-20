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

**English** | [简体中文](./prophet-playbook.zh.md)

# SuiProphet Playbook

Paid knowledge prophecy module (PRD §11). Shares L0 Oracle settlement; no separate Feed.

> **How-to:** Full flow for market creation + public/encrypted prophecies in [prophet-market-and-encryption-guide.md](./prophet-market-and-encryption-guide.md).

## Architecture

**Public (`unlock_price=0`)**

```
canonical JSON plaintext → Indexer /v1/prophecies/blob → Commit (on-chain predicted_* + hash(JSON))
```

**Paid (`unlock_price>0`)**

```
ProphecyPayload → BCS (prophet_plain) → Seal.encrypt(seal_id) → Indexer blob → Commit (on-chain predicted_*=0, hash(BCS))
                    ↓
         seal_approve_prophecy (OR: paid | lock_time | public)
                    ↓
         Seal.decrypt → BCS decode → show numbers + analysis
                    ↓
         audit_prophecy(BCS bytes) → reveal on-chain predicted_* + track record
```

On-chain `blob_id` format:

| Prefix | Storage |
| --- | --- |
| `idx:` | Indexer local disk (`INDEXER_PROPHET_STORAGE=local`) |
| `ipfs:` | IPFS Pin (`INDEXER_PROPHET_STORAGE=ipfs`) |

## Deployment

### 1. Create ProphetRegistry

```bash
sui client call --package $PKG --module prophet_registry --function create_prophet_registry \
  --args $GLOBAL_CONFIG $ADMIN_CAP 500
```

### 2. Environment variables (`app/.env`)

```
NEXT_PUBLIC_PROPHET_REGISTRY_ID=0x...
NEXT_PUBLIC_INDEXER_URL=http://localhost:8800
NEXT_PUBLIC_SEAL_THRESHOLD=1
# When INDEXER_PROPHET_STORAGE=ipfs:
# NEXT_PUBLIC_IPFS_GATEWAY_URL=https://w3s.link
```

Indexer (`services/indexer/.env`):

```
INDEXER_PROPHET_STORAGE=local
# INDEXER_PROPHET_BLOBS_DIR=data/prophecy-blobs
# IPFS_PINATA_JWT=...   # ipfs mode
```

Seal Testnet key servers (configured in `app/src/lib/seal-prophet.ts` → `SEAL_KEY_SERVERS`):

| Name | Object ID |
| --- | --- |
| mysten-testnet-1 | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` |
| mysten-testnet-2 | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` |

**Note:** After redeploying Move package, encrypt with new `PACKAGE_ID`; old ciphertext cannot be decrypted by new `seal_approve` policy.

## Prophet Commit

### Public practice (`unlock_price = 0`)

1. Build canonical JSON (`market_id`, `predicted_value`, `analysis_content`, optional interval)
2. `POST $INDEXER/v1/prophecies/blob?pool_id=...` upload **plaintext**
3. `commit_private_prophecy(..., predicted_* = actual values, plaintext_hash = blake2b256(JSON), seal_id = [])`

### Encrypted paid (`unlock_price > 0`)

1. Generate `seal_id` (32 random bytes)
2. `BCS encode` → `SealClient.encrypt({ packageId, id: hex(seal_id), data: bcsBytes })`
3. `POST $INDEXER/v1/prophecies/blob?pool_id=...` upload ciphertext
4. `commit_private_prophecy(..., predicted_* = 0, plaintext_hash = blake2b256(BCS), prediction_revealed = false)`

On-chain: `lock_time` = Pool `maturity_ts`.

Locally still save **JSON** (for UI audit form); on audit, frontend/keeper re-encodes JSON to BCS bytes for paid prophecies.

## Subscriber unlock + decrypt

1. `unlock_prophecy` pay USDC → `paid_buyers` (Seal **condition A**)
2. Wallet signs `SessionKey` (30 min TTL)
3. PTB calls only `seal_approve_prophecy(seal_id, prophecy, clock)` (dry-run validation)
4. `SealClient.decrypt` + `GET $INDEXER/v1/prophecies/blobs/{filename}` or IPFS gateway

## Web full flow (`/prophet`)

| Step | Action | Notes |
| --- | --- | --- |
| 1. Commit | Prophet fills prediction + analysis | Public: JSON plaintext; paid: BCS + Seal → `predicted_*=0`; save JSON locally for audit |
| 2. Unlock | Subscriber pays USDC | `unlock_prophecy`; page auto-attempts Seal decrypt on success |
| 3. Decrypt | Indexer/IPFS GET + Seal | Paid: decrypt BCS; requires `paid_buyers` ∥ after `lock_time` ∥ `is_public` |
| 4. Audit | After Oracle settlement | `audit_prophecy`: public submits JSON bytes, paid submits **BCS bytes** → hash check → reveal numbers → track record → `is_public` |

Key frontend modules:

- `app/src/lib/prophet.ts` — workflow derivation, `decryptProphecyContent`
- `app/src/lib/seal-prophet.ts` — Seal 1.x + SessionKey
- `app/src/lib/prophet-blob.ts` / `prophet-blob-upload.ts` — Indexer/IPFS read/write

Dual-wallet Testnet acceptance: wallet A Commit → wallet B Unlock (auto decrypt) → Oracle settlement → Audit.

## Seal OR policy (`seal_approve_prophecy`)

| Condition | On-chain check |
| --- | --- |
| A Paid | `sender ∈ paid_buyers` |
| B Public | `now > lock_time` or `is_public` |

## Oracle audit → track record → revenue split

Prerequisite: Pool `resolved` and `now >= lock_time` (aligned with Oracle settlement page; see [oracle-playbook.md](./oracle-playbook.md)).

`prophet-audit-keeper` pulls blob from Indexer/IPFS → Seal decrypt → builds audit bytes per `unlock_price` (JSON or BCS) → submits `audit_prophecy`.

## Modules

| Module | Description |
| --- | --- |
| `prophet_registry` | Commit / unlock / audit / reveal, `seal_approve_prophecy` |
| `prophet_plain` | Paid BCS plaintext struct and hash |
| `prophet_leaderboard` | Prophet Score |
| `services/indexer` | `POST/GET /v1/prophecies/blob` |
| `app/src/lib/seal-prophet.ts` | Seal encrypt/decrypt |
| `app/src/lib/prophet-blob*.ts` | Indexer/IPFS blob I/O |

## Done

- [x] Prophet Audit Keeper (`services/prophet-audit-keeper/`)
