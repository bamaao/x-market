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

**English** | [简体中文](./PRD.zh.md)

# X-Market on Sui — Product Requirements Document

> **Version:** v1.9  
> **Date:** 2026-06-05  
> **Chain:** Sui  
> **Status:** Draft  
> **Background reading:** [docs/qa.md](./docs/qa.md) · **Math spec:** [math-spec/SPEC.md](./math-spec/SPEC.md) · **Oracle playbook:** [docs/oracle-playbook.md](./docs/oracle-playbook.md) · **Knowledge monetization ecosystem:** [SuiProphet_Network.md](./SuiProphet_Network.md)

---

## 1. Project Overview

### 1.1 Positioning

**X-Market on Sui** is the on-chain implementation of a prediction-market **product suite** on Sui: the bottom layer shares a **Unified Event Engine / Oracle**, and the upper layer mounts two composable business modules—

| Module | Product name | Core behavior |
| --- | --- | --- |
| **Trading module** | X-Market | Parametric AMM + PDF pricing; users buy `Position` to take payout risk |
| **Paid module** | SuiProphet Network | Prophets publish private analysis; subscribers pay to unlock; post-hoc on-chain audit of track record |

Both share the same **market root object (`EventRoot`)**: the same real-world event, the same `lock_time`, and the same Oracle settlement result—avoiding data fragmentation between "signal following" and "betting."

### 1.2 One-liner

**Everything is an object: one event root, trading and knowledge monetization grow in parallel.**

### 1.3 Why Sui

- **Everything is an object:** Events, positions, and private predictions can all be modeled as Object / Child Object
- **Dynamic fields:** `EventRoot` mounts AMM pools and Prophet registries via Dynamic Fields—modules decoupled, root unified
- Sharded by `event_id` for parallel settlement and parallel unlock across markets
- High parallel execution throughput, suited to many pools + many prophets coexisting
- Mysten native stack: Sui + Indexer/IPFS + Seal + USDC

### 1.4 Product suite and three-layer architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Application layer: Web App · Prophet profile · Leaderboard · Gas Station │
├─────────────────────────────────────────────────────────────┤
│  Business module layer                                       │
│  ┌─────────────────────┐    ┌─────────────────────────┐     │
│  │ X-Market trading     │    │ SuiProphet paid module   │     │
│  │ MarketPool · Position│    │ PrivateProphecy · stats  │     │
│  └──────────┬──────────┘    └────────────┬────────────┘     │
│             └──────────────┬───────────────┘                   │
│                            ▼                                 │
│              EventRoot (market root · shared)                │
│         lock_time · oracle_feed_id · event_status            │
├─────────────────────────────────────────────────────────────┤
│  Unified Event Engine / Oracle                               │
│  macro_oracle · oracle_arbitrator · DataFeed · committee finalization │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Responsibility | Shared? |
| --- | --- | --- |
| **L0 Event Engine** | Register metrics, optimistic propose, dispute, committee finalization, persist `resolved_value` | Single source of truth for entire product |
| **L1 Market root** | Bind real-world event metadata; point to L0 Feed; manage lifecycle | Shared by trading + paid modules |
| **L2 Business modules** | AMM pricing/positions, or Seal+Indexer private predictions/unlock | Can be enabled independently or stacked |

> **Current implementation (Testnet):** L2 trading module is live (`MarketPool` effectively acts as the market root); L0 Oracle is live (§10); L2 SuiProphet core on-chain modules are live (`prophet_registry` / `prophet_leaderboard`, §11); explicit L1 `EventRoot` abstraction remains **Phase 4 TODO** (see §6).

---

## 2. Product Features (X-Market Trading Module)

> This chapter covers **L2 trading module** scope, mounted on `EventRoot` (§3.7). **L2 paid module** see [§11 SuiProphet Network](#11-suiprophet-network-paid-module).

### 2.1 Distribution templates (from MVP)

| Template | Scenario | On-chain state |
| --- | --- | --- |
| Normal(μ, σ) | CPI, BTC price, TPS | `MarketPool` shared object |
| Poisson(λ) | Football goals, count events | Same |
| Dirichlet(α[]) | Win/draw/loss, elections | Same |

### 2.2 Contract types

| Type | Priority | Description |
| --- | --- | --- |
| Digital option | P0 | PDF probability pricing |
| Interval contract | P0 | ∫f(x)dx interval probability |
| Linear Call/Put | P1 | max(X−K, 0) |
| Straddle | P1 | Push up σ |
| Variance Swap | P2 | Phase 3 |

### 2.3 Parametric AMM behavior

- Users deposit **`Coin<USDC>`** (`MarketPool.vault`) and buy payout commitments
- Trades update `MarketPool` μ/σ/λ/α
- **Position as owned object** belongs to user address; transferable (Phase 2 optional)
- **Tier 1 (MVP):** Parameter updates and probability calculation **atomically completed** inside Move modules
- **Pricing Engine:** Quote preview/SDK only; on-chain is the sole source of truth

### 2.4 Volatility

- Vol Crush, IV, Vol Smile—see [docs/qa.md](./docs/qa.md); **Sui Indexer independently** computes and displays

### 2.5 Margin

- Single-chain Cross-Margining: unified VaR across multiple Positions under one Sui address

### 2.6 Liquidity provision and LP (Sui implementation)

> Product logic in [docs/qa.md](./docs/qa.md) (liquidity injection, Opening Auction).

| Capability | Phase | Sui implementation notes |
| --- | --- | --- |
| Vault + Prior creation | 1 | `create_pool` extension: μ/α/λ + USDC deposit |
| Max-Loss check | 1 | Before each `buy_*`: on-chain worst-case payout ≤ Vault |
| LP Token + global scaling | 1.5 | `deposit_liquidity`: mint LP shares by **NAV** + proportional α scale (probability unchanged) |
| NAV redemption | 2 | `withdraw_liquidity`: `payout = burn_lp × NAV` |
| $T_2$ entry ban | 2 | Reject `deposit_liquidity` in last N% of time before expiry |
| Opening Auction | 1.5 | `auction_deposit` → `finalize_auction` atomic clearing |
| Market state machine | 1.5 | `Auction` → `Trading` → `Settled` |

### 2.7 Opening Auction (Sui)

| Entry (planned) | Description |
| --- | --- |
| `start_auction` | Create market, bidding period, AMM not active |
| `auction_bid` | USDC into win/draw/loss (or interval) buckets |
| `finalize_auction` | Deadline atomic: bucket ratios → α₀, Vault locked, mint Positions, open Trading |
| `buy_poisson_interval` etc. | Callable only in `Trading` state |

### 2.8 LP economics (product summary)

> Full cases and formulas: [docs/qa.md](./docs/qa.md) (Real Madrid vs Barcelona, elections, CPI, breakeven analysis).

| Concept | Description |
| --- | --- |
| LP role | Underwriter; earns slippage, wrong-prediction principal, Theta; loses to adverse selection |
| Path integral | Round-Trip Churn still accumulates Vault premium when probability returns to origin |
| Breakeven | Net revenue ≈ volume × slippage rate − informed arbitrage; example needs **>500k** USDC volume (100k pool, 2% slippage) |
| Operations | Prioritize high-turnover events; pair cold pools with §2.9 |

### 2.8.1 Football goal interval settlement example (Poisson)

Total football goals are discrete integers (0, 1, 2, 3…); the system uses Poisson parameter `lambda` to price interval contracts.  
Interval contracts follow a binary rule at settlement:

- Hit interval: each position pays out 1 USDC
- Miss interval: position zeroed

Example (buy `[2,6]`):

- At order time estimated `lambda = 3.0`
- Theoretical interval probability (price) ≈ `0.65`
- After large buy moves parameters and slippage, average fill ≈ `0.70`
- User invests 1000 USDC, receives position count `1000 / 0.70 = 1428.57`

If final result total goals `X = 5`:

- Because `5 ∈ [2,6]`, settlement payout = `1428.57 * 1 = 1428.57 USDC`
- Net profit = `1428.57 - 1000 = +428.57 USDC`
- ROI = `42.857%`

Comparison:

- If `X = 2`: also hits `[2,6]`, same payout as above
- If `X = 1` or `X >= 7`: miss, position zeroed, loss 1000 USDC

Key point: Parameter updates during trading (`lambda` changes) affect entry cost and position size; final settlement only checks whether the real outcome falls in the purchased interval.

### 2.8.2 Wide intervals (e.g. `[1,7]`) and LP risk profile

"High hit rate on wide intervals" does not mean "long-term favorable for traders."  
Wider intervals mean higher entry price—a "high win rate, low odds" structure for traders.

Example (`lambda = 3.0`):

- `[1,7]` theoretical probability ≈ 95%, price near 0.95
- With slippage, average cost ≈ 0.97
- Invest 1000 USDC, receive `1000 / 0.97 = 1030.93` positions

Two outcomes:

- Normal (~95%): hit pays 1030.93 total, net +30.93 (ROI ≈ 3.09%)
- Tail (~5%): miss zeros position, single loss 1000

This position type is essentially "frequent small wins + infrequent large losses."  
For LPs, the mirror is "frequent small losses + infrequent large wins"; long-term P&L depends on:

- Premium from slippage and fees
- Pool turnover
- Tail outcome frequency
- Risk parameters (see §2.9) suppressing adverse selection

### 2.9 LP engineering defenses (Sui implementation)

> Research [docs/qa.md](./docs/qa.md) "top-tier engineering defenses."

| Mechanism | Phase | Sui implementation notes |
| --- | --- | --- |
| **Dynamic fee engine** | 2 | On-chain: `fee_multiplier_bps` + `lp_guard::effective_fee_bps` (all `buy_*` paths); off-chain: **LP Guard Keeper** (`services/lp-guard-keeper/`) polls pool state, detects μ/λ/α one-sided drift + skew + volume shock, authority signs `set_lp_guard_params`; at max risk effective fee up to **800 bps (8%)** (base 200 bps + multiplier 30000) |
| **Virtual liquidity / σ defense** | 2 | `sigma_virtual_tenths` / `concentration_virtual`; Keeper raises with risk score, multiplier decays by `DECAY_FACTOR` when risk-free |
| **Settlement time lock** | 2 | `paused` + `resolution_window_ts`; ban `buy_*` after expiry |
| Max-Loss (existing) | 1 | `risk.move` |
| Opening Auction (existing) | 1.5 | `pool.move` auction flow |

**On-chain module:** `sources/lp_guard.move`, `pool::set_lp_guard_params`  
**Off-chain Keeper:** `services/lp-guard-keeper/` (see README; `LP_GUARD_DRY_RUN` defaults `true`)

**Risk score (Keeper):** `0.4 × parameter drift + 0.35 × one-sided skew + 0.25 × volume EMA`; window default 10 polls (30s interval ≈ 5 minutes).  
**Forbidden:** Oracle-signed updates to λ/μ/σ; Keeper only adjusts LP defense params, not distribution pricing params.

### 2.10 LP returns and NAV (Sui implementation)

> Research [docs/qa.md](./docs/qa.md) "What about LP returns? Especially when LPs join at different times."

**NAV formula:**

$$\text{NAV} = \frac{\text{vault USDC balance} - L_{\text{mtm}}}{\text{lp\_shares}}$$

| Symbol | `MarketPool` field / module |
| --- | --- |
| $V_{\text{cash}}$ | `vault` `Balance<USDC>` |
| $L_{\text{mtm}}$ | Phase 1.5: `max_k liability_by_k`; Phase 2: full Position MTM |
| $S_{\text{lp}}$ | `lp_shares` |

| Entry | Phase | Behavior |
| --- | --- | --- |
| `deposit_liquidity` | 1.5 | `nav_pre` → `mint_lp = amount / nav_pre` → deposit vault → global α scale |
| `withdraw_liquidity` | 2 | `payout = burn × nav_pre` |
| — | 2 | Ban `deposit` in last N% before expiry ($T_2$) |

**Join timing:** $T_0$ opening pioneer, $T_1$ mid-game premium expansion, $T_2$ late-stage entry ban (reject `deposit_liquidity` in last N% before close); see [docs/qa.md](./docs/qa.md).

**Current implementation gap:** `deposit_liquidity` temporarily adds `lp_shares` 1:1; Phase 1.5 aligns to NAV.

---

## 3. Technical Architecture

### 3.0 Unified Event Engine

The event engine is the product suite's **sole settlement source of truth**, decoupled from business modules (AMM / knowledge monetization):

| Capability | Module | Description |
| --- | --- | --- |
| Feed auto-registration | `pool::create_*_with_feed` / `register_data_feed_for_pool` | Create market in same PTB; `FeedRegistry` index |
| Feed on-chain discovery | `lookup_feed_by_market` / Indexer scan `market_id` | Frontend needs no `ORACLE_FEED_*` env |
| Optimistic propose | `propose_data` | Anyone relays official/result data |
| Dispute filing | `dispute_and_request_arbitration` | Same PTB creates `ArbitrationCase` |
| Committee finalization | `oracle_arbitrator` | Multi-sig committee; **not Admin unilateral** |
| Result consumption | `get_finalized_value` / `set_resolution` | Trading `claim`, Prophet audit shared |

**Principles:**

1. Oracle **settles only**—forbidden from AMM λ/μ/σ pricing (§3.5).  
2. After same `DataFeed` is finalized, all modules on same `EventRoot` read **same** `resolved_value`.  
3. Committee finalization, stake game theory—see [§10](#10-macro-data-oracle).

```
Real-world event published
       │
       ▼
  macro_oracle (L0)
  propose → liveness → [dispute → committee] → Finalized
       │
       ├─► MarketPool.set_resolution  → Position.claim (trading)
       └─► ProphetRegistry.audit      → Leaderboard (paid)  [Phase 4]
```

### 3.1 Project structure (recommended)

```
x-market-sui/
├── packages/
│   └── x_market/
│       ├── market_pool.move
│       ├── position.move
│       ├── settlement.move
│       ├── macro_oracle.move    # macro data optimistic oracle
│       ├── oracle_arbitrator.move  # committee finalization (pluggable)
│       ├── settlement_oracle.move
│       ├── event_root.move        # market root object (Phase 4)
│       ├── prophet_registry.move  # SuiProphet paid/audit (Phase 4)
│       └── math/                  # Tier 1 on-chain math engine
│           ├── poisson.move
│           ├── dirichlet.move
│           ├── normal.move
│           └── fixed_point.move
├── pricing-engine/        # off-chain mirror (preview/SDK)
├── indexer/
├── app/
├── sdk/
└── tests/
    └── math/
```

### 3.2 Architecture diagram

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ X-Market App │  │ Prophet page │  │ Quant SDK    │  │ Gas Station  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       └─────────────────┼──────────────────┴─────────────────┘
                         │
            ┌────────────▼────────────┐
            │  Sui Indexer / GraphQL  │
            └────────────┬────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────▼────┐     ┌─────────▼──────────────────────────┐    ┌─────▼─────┐
│ Indexer │     │         Move Modules (Sui)          │    │   Seal    │
│ Blob    │     │  ┌──────────────────────────────┐  │    │ conditional decrypt │
└─────────┘     │  │ L0 Unified Event Engine       │  │    └───────────┘
                │  │ macro_oracle · oracle_arbitrator│  │
                │  └──────────────┬───────────────┘  │
                │                 │                   │
                │  ┌──────────────▼───────────────┐  │
                │  │ L1 EventRoot (shared)         │  │
                │  │ lock_time · feed_id · status  │  │
                │  └───┬──────────────────┬───────┘  │
                │      │ Dynamic Field    │ Child Obj │
                │  ┌───▼──────────┐  ┌───▼──────────┐ │
                │  │ L2 AMM trading│  │ L2 Prophet   │ │
                │  │ MarketPool    │  │ PrivateProphecy│ │
                │  │ Position      │  │ paid_buyers  │ │
                │  └──────────────┘  └──────────────┘ │
                └─────────────────────────────────────┘
```

### 3.3 Smart contracts (Move)

| Object | Capabilities | Description |
| --- | --- | --- |
| `MarketPool` | `key`, shared | Distribution params, USDC balance, expiry |
| `Position` | `key`, owned | User position, objectified NFT |
| `GlobalConfig` | `key`, shared | Fees, AdminCap |

**Tier 1 on-chain math engine (MVP core):**

| Module | Implementation | Bounds |
| --- | --- | --- |
| `poisson.move` | Factorial LUT + `EXP_NEG_LUT[801]` | λ ∈ [0, 8] |
| `dirichlet.move` | α vector ops + normalization | α ≥ ε |
| `normal.move` | erf Taylor or CDF LUT | bounded μ, σ |
| `fixed_point.move` | Move fixed-point (U128 scale) | precision $10^{-9}$ |

**Sui-specific capabilities:**

- Position as owned object, held directly in user wallet
- Different EventRoot / MarketPool have no write conflicts, parallel transactions
- Dynamic Fields mount module extensions; Child Objects hold private predictions

### 3.7 Market root object (EventRoot) and module mounting

On Sui, a prediction market decomposes into **one shared root object** `EventRoot`; trading and paid modules share this root via Dynamic Fields or Child Objects:

```move
/// Target model (Phase 4) — current Testnet transitions via MarketPool + DataFeed.market_id
public struct EventRoot has key {
    id: UID,
    event_id: vector<u8>,       // global event ID, aligned with DataFeed.identifier
    lock_time: u64,             // event deadline; Seal condition B, stop paid writes
    oracle_feed_id: ID,         // points to macro_oracle::DataFeed
    status: u8,                 // Open · Trading · Locked · Settled · Nullified
    // Dynamic fields (do not bloat root object size):
    //   b"amm"            -> AMMExtension { pool_id, distribution_kind }
    //   b"prophet_registry" -> ProphetRegistry { treasury, protocol_fee_bps }
}
```

| Mounting | Object | Module | Read/write pattern |
| --- | --- | --- | --- |
| **Dynamic Field** `b"amm"` | `AMMExtension` → `MarketPool` ID | X-Market trading | High-frequency writes to `MarketPool`; root read-only reference |
| **Dynamic Field** `b"prophet_registry"` | `ProphetRegistry` | SuiProphet | Unlock fees to treasury; `paid_buyers` in child objects |
| **Child Object** | `PrivateProphecy` | SuiProphet | Prophet owned → Public after settlement; contains `blob_id`, `plaintext_hash` |
| **Child Object** | `Position` | X-Market | Trader owned NFT position |

**Settlement linkage (single Oracle output):**

1. L0 `DataFeed` → `Finalized`, writes `resolved_value`.  
2. L1 `EventRoot.status` → `Settled`.  
3. L2 trading: `MarketPool::set_resolution` → `settlement::claim_position`.  
4. L2 paid: Keeper triggers Prophet audit (§11.4) → Hash verify → stats update → Seal condition B public decrypt.

**Parameter updates:** Pricing + update + state write completed in same PTB.

**Tier 2 (Phase 3):** ZK Coprocessor async verification, non-blocking for transactions.  
> **Decision (2026-06-08):** No Tier 2 joint PDF model before mainnet; see [docs/tier2-decision.md](./docs/tier2-decision.md).

### 3.4 Off-chain services

| Service | Responsibility | Critical path? | Prophet / EventRoot |
| --- | --- | --- | --- |
| **Preview Engine** | Mirror on-chain math, frontend quotes | ❌ | — |
| **Indexer** | Event index, IV display, leaderboard cache | ❌ | Optional; track record truth on-chain `ProphetStats` |
| **LP Guard Keeper** | Dynamic fee / virtual liquidity auto-tuning | ❌ | — |
| **Oracle Relayer** | **Settlement only** at expiry | Settlement only | — |
| **Gas Station** | Sponsored transaction Gas Payer dual-sign | Prophet publish/unlock UX | **Required** (see §11.3.6) |

> Leaderboard and Prophet Score **do not use Indexer as source of truth**; MVP frontend reads on-chain dynamic fields directly via RPC + event scan. See [docs/phase4-services.md](./docs/phase4-services.md).

### 3.5 Oracle (settlement only, no pricing)

| Data type | Approach | Use |
| --- | --- | --- |
| On-chain values | Pyth (Sui) / Supra | Settlement at expiry |
| Macro (CPI, GDP, etc.) | **Macro Data Oracle** (optimistic game + challenge window + pluggable arbitration) | Settlement at expiry |
| Sports | Optimistic Oracle | Settlement at expiry |

> ⚠️ Forbidden: Oracle-signed updates to λ/μ/σ.  
> **Full macro data spec:** see [§10 Macro Data Oracle](#10-macro-data-oracle).

### 3.6 On-chain / off-chain division

| Operation | Tier | On-chain | Off-chain |
| --- | --- | --- | --- |
| Poisson / Dirichlet pricing | 1 | ✅ atomic | Mirror preview |
| Normal CDF (bounded) | 1 | ✅ atomic | Mirror preview |
| Parameter updates | 1 | ✅ atomic | ❌ |
| USDC deposit/withdraw / settlement | — | ✅ | |
| IV surface | — | | ✅ Indexer |
| Multi-dimensional PDF | 2 | Optimistic exec ✅ | ZK async verify |

---

## 4. Frontend (Sui-specific)

### 4.1 Core pages

**X-Market trading:**

- Market list / detail / trading panel
- PDF curve + interval selection
- IV panel
- Positions (Sui address + Position object list)
- Oracle settlement panel (`/oracle`)
- Create market

**SuiProphet paid (Phase 4):**

- Prophet profile / publish private prediction (`/prophet`)
- On-chain leaderboard (`/leaderboard`, Prophet Score)
- Paid unlock (USDC only, Gas Station pays gas; must meet §11.3.7 thresholds)

### 4.2 Wallets

- Sui Wallet, Slush, OKX Wallet (Sui)
- Sui RPC only, no chain switching

### 4.3 Sui-specific UX

- Position objects visible in wallet (NFT-like display)
- Parallel orders across markets without nonce contention

---

## 5. Non-functional Requirements

| Category | Metric |
| --- | --- |
| On-chain confirmation | < 1s (typical Sui) |
| Quote latency | < 200ms |
| API uptime | 99.9% |
| Security | Move-specific audit |
| Compliance | GeoBlock, non-custodial |

---

## 6. Milestones

### Phase 0 (Week 1–4)

- [x] Move package init, MarketPool skeleton
- [x] **Tier 1 on-chain math engine PoC**: `poisson.move` + `dirichlet.move`
- [x] Gas benchmark: single Poisson interval buy (target within acceptable range)
- [x] Testnet deploy + math test vectors

### Phase 1 — MVP (Week 5–12)

- [x] Tier 1 full templates: Poisson / Dirichlet / Normal (bounded)
- [x] Digital option + interval contracts (on-chain atomic)
- [x] USDC Vault + **Max-Loss Bounded Checking**
- [x] **Settlement-only** Oracle (no Prior participation)
- [x] Next.js frontend
- [x] 3 Testnet seed markets

### Phase 1.5 — Cold start and LP (Week 12–14)

- [x] **Opening Auction**: `start_auction` / `auction_bid` / `finalize_auction`
- [x] **NAV subscription**: `deposit_liquidity` mints `lp_shares` by `nav_pre` + global proportional α scale
- [x] Market state machine `Auction` → `Trading`

### Phase 2 (Week 13–20)

- [x] Linear options, Straddle
- [x] IV panel
- [x] Cross-Margin
- [x] **LP defenses:** dynamic fee + virtual σ/concentration + settlement time lock (`lp_guard.move`)
- [x] **NAV redemption**: `withdraw_liquidity`; $T_2$ late-stage subscription ban
- [x] Normal CDF precision stress test

### Phase 3 (Week 21–28)

- [x] Tier 2 ZK Coprocessor (interface + challenge period + delayed finalization)
- [x] Variance Swap, structured notes (Structured / Range / Barrier)
- [x] Slash governance enhancements (timelock + per-tx/period limits + multi-sig execution channel)
- [x] Security fix batch (`u64->u8` narrowing guard, settlement value bounds check, Cross-Margin global position lock)
- [ ] External audit report convergence + mainnet launch (in progress)

### Phase 4 — SuiProphet & EventRoot (Week 29–40)

- [x] **`EventRoot` explicit abstraction**: `event_root.move` + `create_and_link` migration script
- [x] **`prophet_registry` module**: private prediction Commit, `paid_buyers`, unlock revenue split, Hash audit
- [x] **`prophet_leaderboard` module**: Prophet Score formula and track record stats
- [x] **Seal + Indexer/IPFS integration**: threshold encrypt upload; dual OR access policy (paid / public at expiry)
- [x] **Post-hoc audit flow**: `Hash(plaintext) == chain_commit` → win/loss stats → revenue split
- [x] **Prophet Score leaderboard UI**: `/leaderboard` reads chain directly; Indexer cache optional enhancement
- [x] **Gas Station**: sponsored transaction middleware (`services/gas-station/` + `useSponsoredTransaction`)
- [x] **Time window protection**: close paid channel 5 minutes before `lock_time`
- [x] **Paid unlock eligibility**: on-chain `paid_unlock_eligible` (§11.3.7)

---

## 7. KPI

| Phase | Metric | Target |
| --- | --- | --- |
| MVP | Seed markets | ≥ 3 |
| MVP | Weekly active traders | ≥ 500 |
| MVP | TVL (Sui) | ≥ $500K |
| Phase 2 | SDK integrations | ≥ 3 |
| Phase 3 | Institutional AUM | ≥ $5M |
| Phase 4 | Registered prophets | ≥ 100 |
| Phase 4 | Paid unlock GMV | ≥ $50K / month |

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Move numeric precision | Tier 1 fixed-point + math-spec test vectors |
| Oracle front-running | Oracle settles only, no pricing participation |
| Macro data fraud / revisions | Macro Data Oracle stake game + dispute window + pluggable arbitration (§10) |
| LP adverse selection / chickenization | Max-Loss + Opening Auction + **Phase 2 three LP defenses** (§2.9) |
| High gas | Bounded approximation + static LUT |
| Sui ecosystem TVL | Independent operations; prioritize high-turnover seed markets |
| Tier 2 latency | ZK async, non-blocking for transactions |
| Private prediction cheating | On-chain lock `plaintext_hash`; Hash verify in contract at settlement |
| Seal/Indexer availability | Condition B (public at expiry) fallback; Indexer caches public plaintext |
| Near-deadline arbitrage | Close `paid_buyers` writes at `lock_time - 5min` |

---

## 9. Open Questions

1. Move fixed-point library choice: in-house vs community `fixed_point32` -> **Resolved**: chose in-house `math_fixed_point.move` (U128 scale, precision $10^{-9}$) to avoid unnecessary external dependencies and precisely fit probability engine (Taylor expansion, LUT) numeric bounds.
2. Normal CDF approach: math-spec alignment then Gas stress test -> **Resolved**: bounded erf polynomial approximation (`math_normal.move`). Sui Testnet measured single option buy Gas extremely low and stable, validating on-chain CDF feasibility.
3. Whether Position allows secondary transfer -> **Resolved**: removed redundant internal `owner` field; now fully relies on Sui native ownership, supports secondary market transfer via native `sui client transfer` or PTB.
4. Tier 2 ZK: Axiom vs Brevis -> **Decided**: Phase 3 prioritizes **Brevis**. Brevis has stronger Sui ecosystem (and Move architecture) support, fitting structured notes' need for on-chain historical state proofs and async intensive computation.
5. Normal/Poisson additional LP concentration param formula -> **Resolved**: **Proportional Scaling**. Dirichlet proportionally scales $\alpha$ by old/new Vault ratio on subscription; Normal/Poisson via `nav` and token supply conversion, preserving distribution params losslessly.
6. Opening Auction late manipulation mitigation: TWAP / freeze / per-tx cap -> **Resolved (strategy locked)**: **Time Freeze + hard per-tx cap**. Ban large new Bids in window before auction deadline; cap single deposit share to prevent whale last-second opening probability manipulation.
7. **Dynamic fee and virtual liquidity:** detection window, decay curve (see docs/qa.md §LP defenses) -> **Implemented**: `services/lp-guard-keeper/` off-chain Keeper polls `MarketPool`, computes risk score from drift/skew/volume EMA, calls `pool::set_lp_guard_params` to dynamically raise `fee_multiplier_bps` and virtual σ/concentration; calm periods smooth decay via `LP_GUARD_DECAY_FACTOR` (default 0.85). On-chain billing in `lp_guard.move`; ops in `docs/phase2-playbook.md` §1.3.
8. **MarketPool vs EventRoot relationship:** refactor to explicit root object? -> **Decided (Phase 4)**: introduce `EventRoot` shared object, `MarketPool` demoted to Dynamic Field `b"amm"` extension; existing Testnet pools already linked to L0 Oracle via `DataFeed.market_id`; migration uses wrapping not hard fork.

---

## 10. Macro Data Oracle

### 10.0 Positioning

**Macro Data Oracle** core task: provide real, tamper-proof macroeconomic indicators (GDP, CPI, etc.) to the on-chain ecosystem. It **does not need** prediction-market-style Commitment / betting phase; role is on-chain "data courier and notary"—read-only consumption by DeFi, insurance, **prediction market settlement**, and other smart contracts.

This section uses oracle terminology uniformly (`dataIdentifier`, `proposedResult`, `assertionId`), avoiding prediction-market vocabulary (e.g. `marketId`, `proposeOutcome`).

### 10.1 Overview

| Item | Description |
| --- | --- |
| **Product positioning** | On-chain macro/financial data source based on optimistic game (Optimistic Oracle) |
| **Core goal** | Allow any off-chain node to relay officially published macro data on-chain; ensure authenticity via stake and challenge; after finalization open to all contracts |
| **Four-phase loop** | Propose → Challenge → **Arbitrate** → Settle (all required; without arbitration economic game cannot close) |

### 10.2 Core business flow

Data on-chain lifecycle driven by real-world release nodes and on-chain time windows:

```
Event occurs → Propose result → Dispute window → [Optional] Arbitration → Final settlement & consumption
```

1. **Event Occurrence**  
   Official agencies (e.g. US BLS, national statistics bureaus) publish macro indicators at scheduled times.

2. **Propose Result**  
   Off-chain node (Proposer) reads official data, calls contract to write plaintext result (e.g. `CPI = 2.8%`), and **stakes Proposer Bond**.

3. **Dispute Window**  
   Countdown begins (typically 24 hours). Network observers cross-check against official sources.  
   - **No opposition:** countdown ends → dispute-free finalize → data finalized.  
   - **Fraud/error found:** challenger stakes **Disputer Bond** → state enters **In_Arbitration** → hand off to external arbitration layer (UMA DVM, multi-sig/DAO committee, etc.).

4. **Final Settlement & Egress**  
   - After dispute-free finalize or arbitration complete: state → `Finalized`.  
   - Winner redeems bond and receives reward; loser bond forfeited per rules.  
   - External contracts safely read finalized data via read-only interface.

> **Arbitration delay note:** Off-chain arbitration (e.g. UMA DVM vote) typically needs 2–3 days for evidence and voting. Data not consumable during `In_Arbitration`; downstream contracts must handle `revert` with async/retry.

### 10.3 Functional requirements

#### 10.3.1 Macro indicator definition and registration (Data Identifier Registry)

To prevent ambiguity on same indicator, each macro data series must be registered on-chain with standardization.

**Auto-registration + on-chain discovery (product path, v1.8+):**

| Path | Caller | Description |
| --- | --- | --- |
| **Create market = register** | Market creator | `create_poisson_pool_with_feed` etc.: write `DataFeed` in same PTB before `share_pool` |
| **Creator backfill** | `MarketPool.authority` | Legacy pools or non-`_with_feed`: `register_data_feed_for_pool` |
| **Governance override** | Admin | `register_data_feed` (migration/exception fix) |
| **Discovery** | Frontend / Indexer | `FeedRegistry` lookup `DataFeed` by `market_id`; forbid per-market `.env` |

`create_oracle_config` also creates shared **`FeedRegistry`** (`market_id` → `feed_id` dynamic fields), recorded in `OracleConfig.feed_registry_id`.

**Registration elements:**

| Field | Description |
| --- | --- |
| `Data_Identifier` | Unique ID (e.g. `US_CPI_2026_M05`) |
| `Ancillary_Data` | Authoritative URL (e.g. `bls.gov`), precise definition (e.g. "unadjusted CPI YoY"), **first-release principle** (see §10.4.1) |
| `Liveness_Period` | Dispute window duration (seconds) |
| `Bond_Required` | Minimum propose/challenge bond (may tie to TVL, see §10.4.2) |
| `Event_Ts` | Earliest on-chain propose time for official data (usually ≥ linked contract/market maturity) |
| `Linked_Consumer` | Optional: bound consumer object ID (e.g. X-Market `MarketPool`) |

#### 10.3.2 Propose and dispute mechanism (The Optimistic Engine)

Optimistic oracle economic engine: stake game temporarily stores off-chain truth on-chain.

**Data Proposal**

| Item | Content |
| --- | --- |
| **Function** | After macro event, Proposer relays official data plaintext on-chain |
| **Interface** | `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)` |
| **Prerequisites** | Transfer ≥ `Proposer_Bond_Size` system native token (e.g. USDC); `dataIdentifier` in proposable state (see §10.5 state machine); on-chain time ≥ `Event_Ts` |
| **Result** | Generate `assertionId`; Feed/Assertion state → `Proposed`; start `Dispute_Window` |

**Core validation:**

1. No active Assertion for this identifier, and Feed not `Finalized` / not `Settled_As_Null`.  
2. Deduct bond and lock in Assertion object.  
3. Record `proposed_at`, compute `liveness_end_at = proposed_at + Liveness_Period`.

**Data Dispute**

| Item | Content |
| --- | --- |
| **Function** | During dispute window, observers reject fraudulent or erroneous proposals on-chain |
| **Interface** | `disputeData(bytes32 assertionId) external` (equivalent: `disputeAssertion`) |
| **Prerequisites** | Transfer ≥ `Disputer_Bond_Size` native token (usually ≥ Proposer Bond); current time ≤ `liveness_end_at` |
| **State change** | `Proposed` → **`In_Arbitration`**; dispute countdown **immediately void**; **freeze** data stream, reject all Consumer reads |

**Same transaction must:** call `oracle_arbitrator::dispute_and_request_arbitration` (dispute + case filing, see §10.3.3.2).

#### 10.3.3 Arbitration and dispute resolution

Without arbitration module optimistic oracle lacks "supreme court"; game loop cannot complete. **Final authority belongs to committee (or external DVM adapter), not protocol Admin unilateral ruling.**

**Core state machine**

After dispute trigger, state strictly follows path below; **all external data extraction frozen during arbitration**:

```text
[Null]
   └── proposeData ──> [Proposed]
                            ├── (Dispute_Window ends, no challenge) ──> finalize ──> [Finalized]
                            └── disputeData ──> [In_Arbitration]
                                                      ├── arbitration callback (decidable) ──> [Finalized]
                                                      └── arbitration callback (undecidable) ──> [Settled_As_Null]
```

After 72 hours with no valid proposal, Feed may enter `[Settled_As_Null]` (see §10.4.3), distinct from arbitration circuit-breaker: former is "no proposal", latter is "rules/data source undecidable".

**Pluggable arbitration interface**

Supports off-chain decentralized court (**UMA DVM**) or ecosystem-native multi-sig/DAO committee. Testnet default is `oracle_arbitrator` module (committee multi-sig + threshold execution).

| Role | Responsibility | Admin? |
| --- | --- | --- |
| **Protocol ops** | `create_oracle_config`, bind `OracleArbitrator` | Global infra only |
| **Market creator** | `create_*_with_feed` / `register_data_feed_for_pool` | Per-market Feed, not Admin |
| **Anyone** | `propose_data`, dispute-free `finalize_assertion` | No |
| **Anyone** | `dispute_and_request_arbitration` | No |
| **Committee member** | `propose_verdict` / `approve_verdict` / `execute_arbitration` | No (independent multi-sig) |

*1. External arbitration request (Outbound Call)*

- **Trigger:** Same PTB as successful dispute.  
- **Move implementation:**

```move
oracle_arbitrator::dispute_and_request_arbitration(
    oracle, feed, pool, assertion, arbitrator, bond, clock, ctx
);
// Internal: macro_oracle::apply_dispute + create ArbitrationCase
```

*2. Arbitration result callback (Inbound Callback)*

- **Trigger:** After committee reaches threshold, authorized **`OracleArbitrator`** calls `execute_arbitration`.  
- **Move implementation:**

```move
oracle_arbitrator::execute_arbitration(...) {
    macro_oracle::callback_arbitration_result(
        oracle, feed, pool, assertion, verdict_type, resolved_value, ctx
    );
}
```

- **Permission:** `OracleConfig.arbitrator_id` must match; `public(package)` callback only, external cannot call directly.  
- **Same transaction completes:** bond settlement (§10.3.3.4) + state → `Finalized` (or `Settled_As_Null`) + write final `resolvedValue`.

**Final verdict logic and exception handling**

After verifying IPFS/on-chain `Ancillary_Data` rule text, arbitration layer must return one of three outcomes:

| Verdict | Condition | On-chain behavior |
| --- | --- | --- |
| **Proposer wins** | `isProposerCorrect == true` | Adopt original `proposedResult` → `Finalized` |
| **Disputer wins** | `isProposerCorrect == false` | Adopt arbitration `resolvedValue` → `Finalized` |
| **Undecidable** | Official not published, rule gap, data source unverifiable | **Circuit-breaker**: → `Settled_As_Null`; **both bonds refunded**, no penalty |

**Bond settlement and distribution (Slasher Math)**

After arbitration result lands, contract must auto-settle **same block**.

Let proposer bond $B_p$, disputer bond $B_c$, arbitration protocol fee ratio $\gamma$ (e.g. 20%).

**Proposer wins:**

$$\text{Proposer total} = B_p + B_c \times (1 - \gamma)$$

$$\text{Arbitration protocol/treasury} = B_c \times \gamma$$

Disputer receives: $0$.

**Disputer wins:**

$$\text{Disputer total} = B_c + B_p \times (1 - \gamma)$$

$$\text{Arbitration protocol/treasury} = B_p \times \gamma$$

Proposer receives: $0$.

**Dispute-free finalize (no arbitration):** Proposer full refund $B_p$; no forfeiture.

**Undecidable (Settled_As_Null):** $B_p$, $B_c$ refunded in full.

> **Relation to §10.4.2:** §10.4.2 defines bond **size** (TVL-linked); this section defines dispute **settlement distribution**. Implementation may use simplified model (e.g. loser 50% to winner, 50% to protocol), but mainnet should align $\gamma$ with arbitration cost.

#### 10.3.4 Data consumption interface (Data Egress / Consumer Interface)

| Item | Content |
| --- | --- |
| **Function** | DeFi / prediction markets etc. read finalized macro data read-only |
| **Interface** | `getFinalizedData(bytes32 dataIdentifier) external view returns (string memory)` |
| **Safety guard** | Must **revert** if state not `Finalized` (includes `Proposed`, `In_Arbitration`) |

**X-Market settlement consumption example:** After finalization write `resolvedValue` to `MarketPool` (Poisson slot / Dirichlet bucket / Normal value), users call `settlement::claim_position` for payout by actual result.

### 10.4 Key security and boundary design

#### 10.4.1 Data revisions (The Revision Problem)

Governments often publish revised values months later.

- **Principle:** Oracle recognizes **first release only**.  
- **Implementation:** `Ancillary_Data` must state: "Only official **first publication** on specified release date counts; subsequent revisions not retroactive."

#### 10.4.2 Economic security model (Bond Sizing)

Cost of lying must exceed profit from corruption (PfC):

$$Bond_{required} = \max(Minimum\_Bond,\; \alpha \times TVL_{dependent})$$

- $\alpha$: risk coefficient (e.g. 0.05).  
- $TVL_{dependent}$: total on-chain value locked depending on this data identifier (e.g. linked Pool vault + unclaimed positions).

#### 10.4.3 Data source outage or prolonged no proposal (Fallback)

- **Scenario:** Official site down on release day, or no one proposes.  
- **Mechanism:** **72 hours** from `Event_Ts` with no valid data passing dispute period → Feed → `Settled_As_Null`.  
- **Downstream:** Consumer contracts refund or abort per fallback terms (X-Market may extend LP/position refund path).

### 10.5 Data state dictionary (dev reference)

Assertion / Feed must support these states (names may map to Move `u8` constants):

```solidity
enum AssertionState {
    Null,            // no proposal yet
    Proposed,        // proposed, dispute countdown active
    In_Arbitration,  // challenged, arbitrating (Consumer read forbidden)
    Finalized,       // decided, data finalized, external output allowed
    Settled_As_Null  // rule/data anomaly or prolonged no proposal, circuit-breaker void
}
```

| State | Consumer `getFinalizedData` | Description |
| --- | --- | --- |
| `Null` | revert | Awaiting proposal |
| `Proposed` | revert | Within dispute window |
| `In_Arbitration` | revert | Awaiting arbitration callback |
| `Finalized` | returns finalized value | Only readable state |
| `Settled_As_Null` | revert | Business layer uses fallback logic |

### 10.6 Interface summary

| Phase | Function | Caller |
| --- | --- | --- |
| Create market+Feed | `create_*_pool_with_feed(...)` | Market creator (recommended) |
| Backfill Feed | `register_data_feed_for_pool(...)` | Market creator (`authority`) |
| Governance backfill | `register_data_feed(...)` | Admin (migration/fix) |
| Discover Feed | `lookup_feed_entry(registry, market_id)` | Off-chain devInspect / Indexer |
| Bind committee | `set_oracle_arbitrator(arbitrator_id)` | Protocol ops (AdminCap) |
| Create committee | `create_oracle_arbitrator(committee, threshold)` | Protocol ops (AdminCap) |
| Propose | `propose_data(...)` | Anyone (Proposer) |
| Dispute + file case | `dispute_and_request_arbitration(...)` | Anyone (Disputer) |
| Dispute-free settle | `finalize_assertion(...)` | Anyone (after window) |
| Member propose verdict | `propose_verdict(case, verdict_type, value)` | Committee member |
| Member approve | `approve_verdict(case)` | Committee member |
| Execute arbitration | `execute_arbitration(...)` | Anyone (after threshold) |
| Arbitration callback | `callback_arbitration_result(...)` | `oracle_arbitrator` internal only |
| Circuit-breaker | `nullify_feed(...)` | Anyone (72h no proposal etc.) |
| Read | `get_finalized_value(feed)` | Any read-only call |

### 10.7 Engineering index (X-Market)

| PRD concept | Current implementation (Testnet) |
| --- | --- |
| Feed auto-registration | `pool::create_*_with_feed` → `macro_oracle::register_feed_for_pool` |
| FeedRegistry discovery | `FeedRegistry` + `lookup_feed_by_market` |
| Creator backfill | `register_data_feed_for_pool` |
| Admin governance backfill | `register_data_feed` (legacy) |
| Committee create and bind | `oracle_arbitrator::create_oracle_arbitrator` + `set_oracle_arbitrator` |
| propose / dispute / finalize | `propose_data`, `dispute_and_request_arbitration`, `finalize_assertion` |
| Committee finalization | `propose_verdict` → `approve_verdict` → `execute_arbitration` → `callback_arbitration_result` |
| Undecidable circuit-breaker | `verdict_unresolved` → dual bond refund + Feed `Nullified` |
| Market settlement | `finalize_*` / arbitration callback → `market_pool::set_resolution` → `settlement::claim_position` |
| Integration fast path (non-prod) | `settlement_oracle::report_resolution` (skip optimistic flow) |
| Playbook | [docs/oracle-playbook.md](./docs/oracle-playbook.md) |
| Frontend | `app/src/app/oracle/page.tsx` (discover Feed by `pool_id` on-chain) |

**Future enhancements:** External UMA DVM adapter (replace `OracleArbitrator` with cross-chain callback); $\gamma$ fee aligned with UMA (current Testnet 50/50); Indexer auto-index `ArbitrationCase`.

### 10.8 References

- UMA Optimistic Oracle / DVM dispute and vote flow  
- [uma1.md](./uma1.md) — arbitration state machine, Slasher Math, five-state enum  
- [uma2.md](./uma2.md) — oracle terminology standardization, Optimistic Engine, arbitration Outbound/Inbound spec  

---

## 11. SuiProphet Network (Paid Module)

> Full vision doc: [SuiProphet_Network.md](./SuiProphet_Network.md)  
> **Relation to X-Market:** Mounted on same `EventRoot` (§3.7), shares L0 Unified Event Engine (§3.0, §10) settlement; **does not** build separate Oracle.

### 11.0 Positioning

**SuiProphet Network** addresses prediction markets' "bet only, no accumulation" problem: on shared event root, provides professional information producers (prophets/KOLs) a knowledge monetization loop of **pay-before-view, mandatory post-hoc public audit, tamper-proof on-chain track record**.

| Dimension | X-Market trading module | SuiProphet paid module |
| --- | --- | --- |
| User action | Buy `Position`, take payout risk | Pay to unlock private analysis |
| On-chain objects | `MarketPool` / `Position` | `PrivateProphecy` (Child Object) |
| Revenue party | LP + protocol fee | Prophet + protocol unlock fee |
| Settlement dependency | L0 Oracle `resolved_value` | Same `resolved_value` + `plaintext_hash` audit |

### 11.1 Vision and user roles

**Sui + Indexer/IPFS + Seal** native stack; abandons cross-chain privacy schemes for parallel performance and verifiable on-chain state.

| User role | Core behavior | Core value |
| --- | --- | --- |
| **Prophet** | Create public/private predictions, set unlock price, write deep analysis | On-chain win-rate backing; earn unlock revenue |
| **Subscriber (Buyer)** | Browse leaderboard, USDC unlock high win-rate prophet content | Quality Alpha; follow high win-rate addresses |
| **Protocol** | Maintain `EventRoot` + event engine; Crank drives settlement | Unlock fee share to treasury |

### 11.2 Seal dual OR access control

Ciphertext hosted on **Indexer (local) or IPFS**; decryption keys managed by **Seal**; on-chain state drives **OR gate** policy:

- **Condition A (pay-before-view):** request wallet ∈ `PrivateProphecy.paid_buyers`
- **OR**
- **Condition B (public after event):** `now > lock_time` or `EventRoot.status == Settled`

Either condition enables decrypt. After settlement publicly free for all, supporting track record audit and anti-deletion.

### 11.3 Feature modules

#### 11.3.1 Event and market creation

- Any user can launch structured prediction market (options A/B or bind existing `EventRoot`)
- Root fields: `event_id`, `lock_time`, `oracle_feed_id`, `status` (consistent with §3.7)
- Optionally enable AMM trading (Dynamic Field `b"amm"`) and Prophet registry (`b"prophet_registry"`) together

#### 11.3.2 Private prediction publish (Prophet)

Standard JSON wrapper:

```json
{
  "event_root_id": "0x…",
  "predicted_value": 7,
  "analysis_content": "Based on on-chain whale chip concentration analysis…"
}
```

Flow: Seal threshold encrypt → upload Indexer/IPFS get `blob_id` (`idx:` / `ipfs:`) → on-chain Commit child object → record `plaintext_hash`, `unlock_price_usdc`, `lock_time`.

**Practice vs paid phases (§11.3.7):** New prophets default `unlock_price = 0` only (free public practice); on-chain allows `unlock_price > 0` only after track record thresholds.

#### 11.3.3 Instant paid unlock (Subscriber)

1. Browse prophet profile / leaderboard  
2. `unlock_prophecy`: USDC to escrow, address written to `paid_buyers`  
3. Frontend requests Seal (condition A) → locally decrypt Indexer/IPFS ciphertext  

#### 11.3.4 Post-hoc auto audit and settlement

**Shares** L0 Oracle settlement trigger; no manual prophet intervention:

```
Event expires → L0 Oracle finalizes resolved_value
         → EventRoot.status = Settled
         → Seal condition B triggers (public key)
         → Extract plaintext → Hash(plaintext) == on-chain plaintext_hash
              ├─ Match → compare predicted_value vs resolved_value → Win/Loss stats
              └─ Mismatch → cheat flag → deduct score
         → Unfreeze unlock fees: protocol share X% → remainder to prophet
         → Prediction public network-wide
```

#### 11.3.5 On-chain leaderboard

$$\text{Prophet Score} = w_1 \cdot \text{Accuracy Rate} + w_2 \cdot \log(N) + w_3 \cdot \text{ROI}$$

Stats: total events, win rate, current streak, max streak, cumulative buyer ROI. $\log(N)$ dampens pure volume farming weight.

#### 11.3.6 Gas Station (sponsored transactions)

Publish prediction and paid unlock both use **Sponsored Transactions**; user wallet shows USDC changes only, protocol Gas Payer pays SUI Gas.

**Requires local service:** Gas Payer key and sponsor API deployed at `services/gas-station/` (see README); cannot replace with frontend-only.

#### 11.3.7 Prophet tier and paid unlock eligibility

To prevent no-track-record accounts charging immediately, **paid unlock requires on-chain gate** (`prophet_leaderboard::paid_unlock_eligible`), enforced at `commit_private_prophecy` when `unlock_price > 0`:

| Condition | Default threshold | Description |
| --- | --- | --- |
| Audited events | `total_audited ≥ 3` | Must complete free practice predictions audited by Oracle first |
| Prophet Score | `score_bps ≥ 4000` (40/100) | Combined win rate + experience + revenue weight |
| Integrity record | `cheats == 0` | Any Hash cheat permanently loses paid eligibility |

**Free practice:** Predictions with `unlock_price = 0` exempt from above; cold-start on-chain track record; subscribers free decrypt after settlement (Seal condition B).

**Frontend:** `/prophet` shows threshold progress; `/leaderboard` marks "Paid enabled" column.

### 11.4 Security and boundaries

| Mechanism | Description |
| --- | --- |
| **Content tamper-proof** | Pre-lock `plaintext_hash` on-chain; cannot alter plaintext post-hoc to fake perfect predictions |
| **Time window protection** | **5 minutes** before `lock_time` permanently close `paid_buyers` writes, prevent post-result arbitrage |
| **Oracle single truth** | Track record and AMM settlement read same L0 `resolved_value` |

### 11.5 Key UX flows

```
[Prophet] Enter analysis → Seal encrypt → Indexer upload → gas-free Commit
[Buyer]   Leaderboard → unlock USDC → Seal condition A → read immediately
[Audit]   Oracle finalize → Hash verify → leaderboard update → public network-wide
```

### 11.6 Engineering index

| PRD concept | Phase | Planned module |
| --- | --- | --- |
| Market root object | Phase 4 | `event_root.move` |
| Private prediction Commit / unlock | **Ready** | `prophet_registry.move` + `/prophet` UI |
| Track record & leaderboard | **Ready** | On-chain `prophet_leaderboard` + `/leaderboard`; Indexer optional |
| Settlement trigger | **Ready** | `macro_oracle` + `oracle_arbitrator` (§10) |
| AMM trading | **Ready** | `market_pool` + `position` + `settlement` |
| Indexer blob / Seal | **Testnet ready** | `prophet-blob*.ts` + `seal-prophet.ts` + `seal_approve_prophecy` |
| Paid unlock eligibility | **Ready (on-chain)** | `paid_unlock_eligible` + PRD §11.3.7 |
| Gas Station | **Ready** | `services/gas-station/` + `useSponsoredTransaction` |
| EventRoot | **Ready** | `event_root.move` + `wrap-event-roots-testnet.ps1` |

**Migration path:** Existing `MarketPool` already linked to L0 Feed via `DataFeed.market_id`; Phase 4 adds `EventRoot` wrapper, moves `pool_id` into Dynamic Field, Prophet child objects on same root, **no duplicate Oracle registration**.

### 11.7 References

- [SuiProphet_Network.md](./SuiProphet_Network.md) — original product vision  
- [Walrus](https://walrus.site/) · [Seal](https://seal.mystenlabs.com/) — Mysten storage and key management  
- §3.0 Unified Event Engine · §3.7 EventRoot · §10 Macro Data Oracle

---

*One event, one truth; trading and prophecy, same root.*
