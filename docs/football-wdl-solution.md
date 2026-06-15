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

[简体中文](./football-wdl-solution.zh.md) | **English**

# Football Win-Draw-Loss Prediction Solution

> **Version:** v1.0 · **Date:** 2026-06-16  
> **Status:** Draft  
> **Source:** Derived from [Categorical_Distribution_QA.md](./Categorical_Distribution_QA.md)  
> **Related:** [business-spec.md](./business-spec.md) · [qa.md](./qa.md) · [math-spec/SPEC.md](../math-spec/SPEC.md)

---

## Summary

Football **win-draw-loss (1X2)**, **handicap WDL (giving)**, and **handicap WDL (receiving)** share one mathematical family: three mutually exclusive categorical outcomes at the trading layer, driven by a **Skellam** goal-difference model with handicap shift \(h\).

| Layer | Distribution | Role |
| --- | --- | --- |
| **Surface** | Categorical | Mint three tokens; settle 0/1 per label |
| **Driver** | Skellam(\(\lambda_H, \lambda_A\)) | \(Z = X - Y\); \(Z' = Z + h\) → \(p_W, p_D, p_L\) |

**Unified API:** `get_quota(λ_H, λ_A, h)` — \(h=0\) is standard 1X2; \(h=-1\) is home giving 1; \(h=+1\) is home receiving 1.

---

## Skellam vs Dirichlet

| Dimension | Skellam (linked) | Dirichlet (isolated pool) |
| --- | --- | --- |
| Business fit | Native net-goals + handicap | Each line needs its own \(\alpha\) pool |
| TVL efficiency | High — one \(\lambda\) pair links all lines | Low — fragmented pools |
| On-chain cost | High (Bessel) — use off-chain + 32B coeffs | Low — pure algebra |
| Cross-line arbitrage | Strong | Weak |

**Production pattern:** Off-chain Skellam mapping + on-chain Horner / 2-point LUT (~32 bytes per trade, Pull mode, TSS + circuit breakers + slippage).

---

## Security

1. **Threshold signatures** on coefficients — never accept raw off-chain data.
2. **Sanity checks** — \(\sum p_k \approx 1\); max \(\lambda\) step per update.
3. **Deadline + slippage** — stale quotes rejected; user `max_price` in tx.
4. **Optional two-step** — freeze USDC at \(B_1\); relayer settles with \(B_1\)-anchored coeffs.

---

## Evolution vs Current x-market-sui

| Phase | Content |
| --- | --- |
| **Phase 1 (now)** | Dirichlet WDL MVP · separate Poisson goals pool |
| **Phase 2** | Off-chain Skellam engine + indexer consistency monitoring |
| **Phase 3** | On-chain \(\lambda_H, \lambda_A\) + Pull polynomial settlement |
| **Phase 4 (opt.)** | Two-step async + cross-margin linkage |

See [football-wdl-solution.zh.md](./football-wdl-solution.zh.md) for the full specification (tables, mermaid diagram, decision checklist, appendices).
