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

[简体中文](./iv-lp-guard-and-vol-crush-explained.zh.md) | **English**

# IV / LP Guard & Vol Crush — Detailed Guide

> **Version:** v1.0 · **Date:** 2026-06-20  
> **Type:** Local archive (conversation digest)  
> **Scope:** IV / LP Guard panel, on-chain LP defenses, LP Guard Keeper, Vol Crush math  
> **Related:** [phase2-playbook.md](./phase2-playbook.md) · [trading-fee-bps-explained.md](./trading-fee-bps-explained.md) · [mainnet-governance-params.md](./mainnet-governance-params.md) · [qa.md](./qa.md) · [glossary.md](./glossary.md)

---

## Summary

On `/markets/[id]`, the **IV / LP Guard panel** combines:

- **IV (Implied Volatility):** off-chain Indexer observability of pool uncertainty
- **LP Guard:** Phase 2 on-chain LP defense against adverse selection and late-stage arbitrage

IV is **observational**; LP Guard is **executional**. **Vol Crush** is an Indexer metric for time-decay of uncertainty: `vol_crush_bps = IV × √τ × 100`. It is display-only and does not change on-chain pricing.

---

## Part 1: IV / LP Guard

### Why LP Guard?

LPs underwrite the pool: they earn fees/slippage but face informed traders, one-sided dumps, late vulture deposits, and oracle latency arbitrage.

Three on-chain defenses (see [qa.md](./qa.md) §4):

1. **Dynamic fees**
2. **Virtual liquidity**
3. **Time windows** (buy ban + deposit cutoff)

### Five on-chain parameters

Set via `pool::set_lp_guard_params` (Pool Authority only):

| Parameter | Field | Effect |
| --- | --- | --- |
| Fee multiplier | `fee_multiplier_bps` | Scales base fee |
| Virtual σ | `sigma_virtual_tenths` | Normal pools: σ_eff = σ + virtual |
| Virtual concentration | `concentration_virtual` | Dirichlet: flattens outcome probs |
| T2 deposit cutoff | `deposit_cutoff_bps` | Blocks `deposit_liquidity` near expiry |
| Resolution window | `resolution_window_ts` | Blocks all `buy_*` before maturity |

**Effective fee:**

```
effective_fee = fee_bps × (10_000 + fee_multiplier_bps) / 10_000
```

Example: base 200 bps + multiplier 30000 → effective 800 bps (8% cap).

### LP Guard Keeper

Off-chain service `services/lp-guard-keeper/` polls pools (default 30s) and calls `set_lp_guard_params`.

**Risk score** (window of ~10 snapshots):

| Signal | Weight | Meaning |
| --- | --- | --- |
| Parameter drift | 40% | μ/λ/α change |
| Directional skew | 35% | Same-direction updates / Dirichlet concentration |
| Volume shock | 25% | `collateral_usdc` delta vs EMA |

```
riskScore = drift×0.4 + skew×0.35 + volume×0.25
```

- `riskScore > 0.05`: raise fee multiplier (up to 800 bps effective), virtual σ/concentration
- else: decay multiplier × 0.85 per tick
- On-chain update only if change exceeds threshold (e.g. 200 bps)

### IV metrics (Indexer)

| Metric | Meaning |
| --- | --- |
| `iv_tenths` | IV proxy (pool-kind specific) |
| `tau_bps` | Normalized time to maturity τ ∈ [0,1] |
| `vol_crush_bps` | IV × √τ × 100 |
| `sigma_eff_tenths` | σ + σ_virtual |

IV panel (`IvPanel.tsx`) reads pool state via RPC and IV history from Indexer.

### Buy path

Every `buy_*`:

1. `assert_buy_window_open`
2. `effective_fee_bps` → `net_stake_after_fee`
3. Price with σ_eff or virtual Dirichlet prob
4. Max-Loss check → update pool → mint Position

---

## Part 2: Vol Crush Math

### Intuition

Prediction markets have hard expiry \(T\). As \(t \to T\), uncertainty should collapse unless major new information arrives. **Vol Crush** models that decay.

### Symbols

- \(\tau = (T - t) / (T - T_0)\) — normalized remaining life
- IV — `iv_tenths` from pool state

### Core formula

\[
\text{vol\_crush\_bps} = \text{IV} \times \sqrt{\tau} \times 100
\]

**Why √τ?** Under constant information arrival (Brownian-like), remaining variance ∝ τ, so remaining std dev ∝ √τ.

| τ | √τ | vol_crush (IV=50) |
| --- | --- | --- |
| 100% | 1.00 | 5000 |
| 25% | 0.50 | 2500 |
| 0% | 0 | 0 |

### On-chain vs Indexer

| | On-chain σ | `vol_crush_bps` |
| --- | --- | --- |
| Used in pricing | Yes | No |
| Auto time decay | No | Yes (√τ each sample) |

High Vol Crush near expiry means trading is keeping σ elevated against natural decay.

### One-liner

**Vol Crush = time-adjusted remaining uncertainty under constant IV; converges to 0 as τ → 0. Display metric only — not enforced in Move pricing today.**

---

## Source index

| Component | Path |
| --- | --- |
| LP Guard Move | `sources/lp_guard.move` |
| Pool entrypoints | `sources/pool.move` |
| Keeper | `services/lp-guard-keeper/` |
| IV compute | `services/indexer/src/chain/parse.ts` |
| Frontend | `app/src/components/IvPanel.tsx` |

---

## Changelog

| Date | Version | Notes |
| --- | --- | --- |
| 2026-06-20 | v1.0 | Initial archive from conversation |
