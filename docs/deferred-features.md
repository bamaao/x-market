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

# Deferred Features List (Beta · UMA DVM · Normal Auction)

**English** | [简体中文](./deferred-features.zh.md)

> **Version:** v1.1 · **Date:** 2026-06-08  
> **Status:** Beta / UMA / Normal auction all implemented  
> **Related:** [tier2-decision.md](./tier2-decision.md) · [math-spec/SPEC.md](../math-spec/SPEC.md) §7 · [p2-indexer-runbook.md](./p2-indexer-runbook.md) §P2.6 · [phase1.5-playbook.md](./phase1.5-playbook.md)

---

## Summary

The following three items are planned in the PRD / math-spec. **Beta CDF, UMA DVM, and Normal Opening Auction were all implemented on 2026-06-08.**

| Capability | Fully implemented? | Existing alternative | Required before mainnet? |
| --- | --- | --- | --- |
| **Beta distribution** | ✅ | Dirichlet binary/trinary approximation | No |
| **UMA DVM** | ✅ | Built-in multisig committee in `OracleArbitrator` (`adapter_type=0`) | Optional (dual adapters coexist) |
| **Normal Opening Auction** | ✅ | `create_normal_pool` still available for direct Trading | No |

---

## 1. Beta Distribution — Implemented (2026-06-08)

### 1.1 Implementation Summary

| Item | Status | Location |
| --- | --- | --- |
| `math_beta` Beta CDF / interval probability | ✅ | `sources/math/beta.move` |
| `KIND_BETA = 3` | ✅ | `market_pool.move` |
| `create_beta_pool` / `buy_beta_interval` | ✅ | `pool.move` |
| `update_beta_buy` / LP scaling | ✅ | `math_beta` + `deposit_liquidity` |
| Settlement (integer % 0–100) | ✅ | `settlement.move` |
| Max-Loss (101 liability buckets) | ✅ | `risk::zero_liability_beta` |
| Unit tests | ✅ | `math_beta_tests.move` (75/75 full suite pass) |
| Web / Mobile | ✅ | `markets.ts` · `TradePanel` · Flutter |

### 1.2 Design Notes

- **Shape parameters:** `α` and `β` stored in `dirichlet_alphas[0..1]`, `dirichlet_len=2`.
- **Interval encoding:** Buy args use **permille** (0–1000, e.g. 350–400 = 35%–40%); positions and settlement use **integer percentage** 0–100.
- **CDF:** Integer `(α, β)` binomial identity + Q32.32 fixed-point; symmetric transform reduces term count.
- **Parameter update:** Increment `α` or `β` based on interval center vs mean direction, with bidirectional concentration boost.

**Create pool:**

```powershell
sui client call --package $PKG --module pool --function create_beta_pool \
  --args 10 10 $MATURITY 30
```

**Buy interval:**

```powershell
sui client call --package $PKG --module pool --function buy_beta_interval \
  --args $POOL $USDC 350 400 $CLOCK
```

---

## 2. UMA DVM Adapter — Implemented (2026-06-08)

### 2.1 Implementation Summary

| Item | Status | Location |
| --- | --- | --- |
| `adapter_type` (builtin / uma_dvm) | ✅ | `OracleArbitrator` |
| `create_uma_dvm_arbitrator` | ✅ | `oracle_arbitrator.move` |
| Outbound `UmaDvmArbitrationRequested` | ✅ | Emitted in same PTB on dispute |
| Inbound `execute_uma_dvm_arbitration` | ✅ | Allowlisted Relayer |
| Off-chain Relayer (mock / live placeholder) | ✅ | `services/uma-dvm-relayer/` |
| Indexer `arbitration_adapter` | ✅ | `migrations/004_uma_dvm.sql` |
| Frontend Oracle / cases panel | ✅ | Adapter badge + UMA flow hints |

**Testnet init:**

```powershell
.\scripts\init-uma-dvm-arbitrator.ps1 -PackageId 0x... -RelayerAddress 0x...
.\scripts\bootstrap-services-env.ps1
cd services/uma-dvm-relayer && npm install && npm start
```

---

## 3. Normal Opening Auction — Implemented (2026-06-08)

### 3.1 Implementation Summary

| Item | Status | Location |
| --- | --- | --- |
| `start_normal_auction` | ✅ | `pool.move` |
| `finalize_normal_auction` | ✅ | `pool.move` + `market_pool.move` |
| Buckets → (μ, σ) calibration | ✅ | `math_normal::mu_sigma_tenths_from_auction_buckets` |
| Web / Mobile auction UI | ✅ | `AuctionPanel` · `auction.ts` · Flutter |

---

## 4. Relationship to Tier 2 Decision

[tier2-decision.md](./tier2-decision.md) resolves not to ship **Tier 2 joint PDF** before mainnet. All three items here are **Tier 1 extensions or Oracle governance enhancements**, with no dependency on Tier 2.

---

## 5. Verification Checklist

### Beta

- [x] `sui move test` includes `math_beta_tests`
- [x] Frontend / Mobile can trade Beta pools (`buy_beta_interval`)
- [ ] Formal Beta vectors in `math-spec/test-vectors.json` (pending reference crate extension)
- [ ] Fill `NEXT_PUBLIC_POOL_BETA` env after Testnet seed pool deployment

### UMA DVM

- [x] Move adapter + mock Relayer
- [ ] `UMA_DVM_MODE=live` wired to real UMA API
- [ ] Testnet full dispute → mock Relayer → callback closed-loop drill

### Normal auction

- [x] Full on-chain scripts + Web/Mobile UI

---

## 6. Revision History

| Date | Version | Notes |
| --- | --- | --- |
| 2026-06-08 | v1.0 | Initial: Beta / UMA DVM / Normal auction gaps |
| 2026-06-08 | v1.1 | Full Beta CDF implementation; all three marked implemented |
