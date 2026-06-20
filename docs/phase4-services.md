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

**English** | [简体中文](./phase4-services.zh.md)

# Phase 4 Architecture: EventRoot · Leaderboard

> Do stats/rankings require local services?

## Summary

| Capability | On-chain source of truth | Local service required? | Notes |
| --- | --- | --- | --- |
| **Track record / Prophet Score** | `ProphetRegistry` → DF `ProphetStats` | **No (MVP)** | Frontend RPC + event scan |
| **Leaderboard page** | Same | **No (MVP)** | `/leaderboard` reads chain directly |
| **Subscriber ROI aggregation** | Scattered in `PrivateProphecy` + audit events | **Indexer recommended** | Non-critical path; Phase 4+ |
| **LP Guard Keeper** | `MarketPool.fee_multiplier_bps`, etc. | **No** | Auto dynamic fees; see `services/lp-guard-keeper/` |
| **EventRoot** | `event_root.move` shared object | **No** | Pure on-chain; one-time migration script off-chain |

**Principle:** Leaderboard and track-record **authority** comes from on-chain `prophet_leaderboard`; local services only **accelerate, aggregate, and improve UX** — not a second source of truth.

---

## EventRoot (L1 market root)

**Module:** `sources/event_root.move` (`create_and_link` one-shot wrap migration)

```
EventRoot (shared)
  ├─ DF b"amm"              → MarketPool ID
  ├─ DF b"prophet_registry" → ProphetRegistry ID
  └─ oracle_feed_id · lock_time · status
```

**Current Testnet transition:** `MarketPool` + `DataFeed.market_id` act as factual root; new markets can migrate to `create_event_root` + `link_*`.

**Local service:** One-time migration script `scripts/wrap-event-roots-testnet.ps1` only; not a runtime dependency.

---

## Leaderboard

### MVP (implemented)

1. `queryEvents(ProphecyCommitted)` collects prophet addresses
2. `getDynamicFieldObject(registry, prophet)` reads `ProphetStats`
3. Client-side sort → `/leaderboard`

### Production enhancement (optional Indexer)

| Index table | Purpose |
| --- | --- |
| `prophet_stats` | Cache Score, rank changes |
| `prophecy_index` | List prophecies by market/time |
| `buyer_roi` | Subscriber follow ROI (link unlock + audit results) |

Indexer **does not** participate in paid-unlock eligibility; threshold enforced on-chain via `paid_unlock_eligible`.

---

## Prophet paid-unlock threshold (PRD §11.3.7)

On-chain `commit_private_prophecy` when `unlock_price > 0` checks:

- `cheats == 0`
- `total_audited >= 3`
- `score_bps >= 4000` (40/100)

New prophets must publish **`unlock_price = 0`** free prophecies first; after Oracle audits accumulate track record, paid unlock is allowed. Prophet on-chain txs (Commit / Unlock / Audit) use SUI gas from the user wallet.
