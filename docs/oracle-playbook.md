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

**English** | [简体中文](./oracle-playbook.zh.md)

# Oracle Settlement Playbook (Macro Data Oracle)

Optimistic oracle flow (see [PRD.md §10](../PRD.md#10-宏观经济数据预言机macro-data-oracle)):

```
Event occurs → propose_data (bond) → dispute window → [optional] committee arbitration → Pool Settled → claim
```

## Role split

| Role | Responsibilities | What it is NOT |
| --- | --- | --- |
| **Protocol ops** | Create `OracleConfig` (incl. `FeedRegistry`), create and bind `OracleArbitrator` | Not dispute arbiter; does not register Feed per market |
| **Market creator** | `create_*_pool_with_feed` or `register_data_feed_for_pool` | Not Admin |
| **Proposer** | `propose_data` after official data release | — |
| **Disputer** | `dispute_and_request_arbitration` within dispute window | — |
| **Committee member** | Multisig vote on `ArbitrationCase`, `execute_arbitration` | Not Admin single-button |

## On-chain modules

| Module | Description |
| --- | --- |
| `macro_oracle` | `FeedRegistry`, creator Feed registration, propose, dispute-free finalize, callback settlement, consume |
| `pool` | `create_*_pool_with_feed`: auto-register Feed in same PTB as market creation |
| `oracle_arbitrator` | Committee multisig arbitration (pluggable DVM adapter entry) |
| `settlement_oracle` | Admin fast report (**Testnet integration only**, not production path) |
| `settlement` | User `claim_position` (requires Pool resolved) |

## Post-deploy initialization (protocol ops)

### 1. Create OracleConfig

```bash
sui client call --package $PKG --module macro_oracle --function create_oracle_config \
  --args $GLOBAL_CONFIG $ADMIN_CAP 10000000 86400
# minimum_bond=10 USDC, liveness=24h
```

### 2. Create arbitration committee and bind

```bash
# Committee addresses + threshold (e.g. 2-of-3)
sui client call --package $PKG --module oracle_arbitrator --function create_oracle_arbitrator \
  --args $GLOBAL_CONFIG $ADMIN_CAP '["0xMember1","0xMember2","0xMember3"]' 2

sui client call --package $PKG --module macro_oracle --function set_oracle_arbitrator \
  --args $GLOBAL_CONFIG $ADMIN_CAP $ORACLE_CONFIG $ARBITRATOR_ID
```

### 3. Auto-register Feed at market creation (recommended)

When creating a market, call `pool::create_*_pool_with_feed` in the same PTB (internal `register_feed_for_pool`); `FeedRegistry` writes `market_id → feed_id`.

```bash
# Example: Normal pool + Feed (params per pool.move)
sui client call --package $PKG --module pool --function create_normal_pool_with_feed \
  --args $GLOBAL_CONFIG $ORACLE_CONFIG $FEED_REGISTRY $USDC_TYPE ... \
  "vector<u8>:US_CPI_2026_M05" $MATURITY_TS 86400 10000000 \
  "vector<u8>:https://bls.gov/... first release only"
```

`event_ts` should be ≥ Pool `maturity_ts`.

**Legacy pool registration** (only `MarketPool.authority`):

```bash
sui client call --package $PKG --module macro_oracle --function register_data_feed_for_pool \
  --args $ORACLE_CONFIG $FEED_REGISTRY $POOL \
  "vector<u8>:US_CPI_2026_M05" $MATURITY_TS 86400 10000000 \
  "vector<u8>:https://bls.gov/... first release only"
```

Admin governance path `register_data_feed` is for migration/exception fixes only.

### 4. Write `app/.env` (global, no per-market Feed)

```
NEXT_PUBLIC_ORACLE_CONFIG_ID=0x...
NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=0x...
NEXT_PUBLIC_ORACLE_MARKETS=normal,dirichlet,poisson   # poolId only; Feed discovered on-chain
NEXT_PUBLIC_GLOBAL_CONFIG=0x...
```

Frontend discovers Feed via `FeedRegistry.lookup_feed_by_market(pool_id)` or scanning `DataFeed.market_id`. **Do not** configure `ORACLE_FEED_*`.

## One-shot initialization (Testnet)

```powershell
.\scripts\init-oracle-testnet.ps1 -RegisterSeedFeeds
# Output NEXT_PUBLIC_ORACLE_CONFIG_ID / ORACLE_ARBITRATOR_ID → write to app/.env.local
```

Script sequence: `create_oracle_config` → `create_oracle_arbitrator` → `set_oracle_arbitrator`; optionally register Feeds for seed pools in `deploy/testnet.json`.

## Full flow (Web `/oracle`)

```
Propose → [dispute window] → Finalize (no dispute) or committee arbitration (dispute) → Pool resolved → claim on /positions
```

Four-step wizard at top of page; after dispute filing, **auto-discovers** `ArbitrationCase` (event `ArbitrationCaseOpened` + object scan).

## Settlement operations

### Proposer (after event)

- Web: `/oracle` → select market (Pool) → auto-discover Feed on-chain → **Propose result**
- On-chain: `macro_oracle::propose_data`

### Disputer (within dispute window)

- Web: **Dispute and file case** (same PTB)
- On-chain: `oracle_arbitrator::dispute_and_request_arbitration`
- Emits `ArbitrationCaseOpened`; frontend resolves Case ID from tx `objectChanges` or event index

### Dispute-free Finalize

- After dispute window, anyone may **Finalize**
- On-chain: `macro_oracle::finalize_assertion`

### Disputed — committee arbitration

1. Member **`propose_verdict`** (proposer wins / challenger wins + adopted value / undecidable)
2. Other members **`approve_verdict`**
3. At threshold, anyone **`execute_arbitration`** → internal `callback_arbitration_result`

| Verdict | On-chain effect |
| --- | --- |
| Proposer wins | Adopt original `claimed_value`; both bonds returned |
| Challenger wins | Adopt `resolved_value`; proposer bond slashed |
| Undecidable | Feed circuit-break; both bonds returned |

### 72h no proposal

- `macro_oracle::nullify_feed`

## Result semantics (claimed_value)

| Market type | resolved_value meaning |
| --- | --- |
| Poisson | outcome slot 0–14 |
| Dirichlet | winning bucket 0–2 |
| Normal | macro value (tenths, e.g. CPI 2.8% → 28) |

## Verification

```bash
sui move test   # macro_oracle_tests + oracle_arbitrator_tests
```

After Finalize or committee arbitration: Oracle page shows settlement banner → Web **Positions** → **Claim payout** (`settlement::claim_position`).

### Case discovery (off-chain)

| Method | Description |
| --- | --- |
| Tx parsing | `getTransactionBlock` → `objectChanges` for `oracle_arbitrator::ArbitrationCase` |
| Events | `queryEvents` → `ArbitrationCaseOpened`, filter by `assertion_id` |
| Scan | `queryObjects` filter `ArbitrationCase`, match `assertion_id` |
