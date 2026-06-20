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

[简体中文](./glossary.zh.md) | **English**

# X-Market Sui Glossary

> **Version:** v1.0 · **Date:** 2026-06-19  
> **Purpose:** System-wide term definitions and quick index; each entry is 1–3 sentences + deep-dive link.  
> **Not a replacement for:** long-form tutorials in [qa.md](./qa.md) or engineering playbooks and [math-spec/SPEC.md](../math-spec/SPEC.md).

---

## How to use

| Goal | Go to |
| --- | --- |
| Look up one term | This doc or the [index](#index) |
| Understand end-to-end business flows | [business-spec.md](./business-spec.md) |
| Formulas and on-chain math | [on-chain-distribution-math.md](./on-chain-distribution-math.md) |
| Short public answers | [faq-public.md](./faq-public.md) |
| Operations | Phase playbooks / runbooks |

---

## 1. Product & architecture

| Term | Definition | Deep dive |
| --- | --- | --- |
| **X-Market** | The **trading module** on Sui: users buy `Position` with USDC; LPs underwrite payouts; pricing uses a parametric AMM over probability distributions. | [PRD §2](../PRD.md) |
| **SuiProphet** | The **prophet module**: ranks verifiable predictors and accumulates on-chain track records; eligible prophets can enable paid unlock (Seal-encrypted analysis). | [SuiProphet_Network.md](../SuiProphet_Network.md) |
| **Unified Event Engine** | L0 Oracle layer — the **single settlement source of truth** shared by trading claims and prophet audits. | [PRD §3.0](../PRD.md) |
| **EventRoot** | L1 market root: binds real-world event, `lock_time`, Oracle feed; mounts AMM pool and Prophet. On Testnet, `MarketPool` acts as the de facto root; explicit `event_root` is Phase 4. | [PRD §3.7](../PRD.md) |
| **L0 / L1 / L2** | Three layers: L0 = Oracle settlement; L1 = market root; L2 = trading (AMM) or prophet (paid) modules. | [business-spec.md §1.3](./business-spec.md) |
| **Parametric AMM** | Pool maintains distribution parameters (μ/σ/λ/α); trades update parameters; interval prices come from PDF integration, not x·y=k swaps. | [qa.md §2](./qa.md) |
| **Tier 1** | Single-variable distributions; parameter updates and probability math are **atomic on-chain** — the MVP hot path. | [tier2-decision.md](./tier2-decision.md) |
| **Tier 2** | Multi-dimensional / joint PDF; optimistic off-chain pricing + async Attestation/ZK supervision — **deferred before mainnet**. | [tier2-decision.md](./tier2-decision.md) |
| **Pricing Engine / Preview** | Off-chain `pricing-engine/` mirroring on-chain math for quotes; **on-chain is the sole source of truth**. | [math-spec/SPEC.md](../math-spec/SPEC.md) |
| **Everything is an object** | Sui modeling: `MarketPool`, `Position`, `PrivateProphecy`, etc. are on-chain objects — parallelizable and composable. | [PRD §1.3](../PRD.md) |

---

## 2. Units & encoding

| Term | Definition | Example |
| --- | --- | --- |
| **bps (basis point)** | 1 bps = 0.01%; 10,000 bps = 100%. Used for fees, multipliers, slash caps. | 200 bps = 2% fee |
| **tenths** | Fixed-point scale for Normal markets: value ×10 on-chain. CPI 2.5% → `25 tenths`. | `sigma_tenths`, `mu_tenths` |
| **ppb** | Probability in parts per billion; `entry_prob_ppb` stores theoretical buy probability. | 700,000,000 ppb ≈ 0.70 |
| **permille** | On-chain Beta scale: 0–1000 maps to [0, 1]. | `x_permille = 250` → 25% |
| **Q32.32 fixed-point** | No floats on-chain; probabilities as `u128`, `1.0` = `2^32`. | [fixed_point.move](../sources/math/fixed_point.move) |
| **USDC / mist** | Settlement and vault unit; Circle native USDC, 6 decimals. | `vault` `Balance<USDC>` |
| **mist (SUI)** | Smallest SUI unit; Gas Station pays SUI gas, not USDC. | [gas-station-implementation.md](./gas-station-implementation.md) |

---

## 3. Probability, distributions & PDF

| Term | Definition | Module / use case |
| --- | --- | --- |
| **PDF** | Probability density for continuous variables; product sense: “one curve describes the event outcome distribution.” | — |
| **PMF** | Point mass for discrete outcomes, e.g. Poisson P(X=k). | `poisson.move` |
| **CDF** | P(X ≤ x); Normal intervals use Φ(b)−Φ(a). | `normal.move` |
| **On-chain ≠ full PDF** | Move computes **pricing quantities only** (PMF, marginals, interval integrals), not the full density curve. | [on-chain-distribution-math.md §1](./on-chain-distribution-math.md) |
| **Poisson(λ)** | Discrete count distribution; λ = expected count. Football goals, etc. | `buy_poisson_*` |
| **Dirichlet(α[])** | Multi-category distribution; marginal pᵢ = αᵢ/Σα. WDL, elections. | `dirichlet.move` |
| **Normal(μ, σ)** | Continuous normal; μ = mean belief, σ = uncertainty. CPI, BTC, macro ranges. | `normal.move` |
| **Beta(α, β)** | Proportion events on [0,1]; vote share, etc. Beta CDF + permille on-chain. | `beta.move` |
| **Skellam** | Distribution of Z=X−Y for independent Poissons; WDL bottom layer (off-chain engine + on-chain coeffs). | [football-wdl-solution.md](./football-wdl-solution.md) |
| **Categorical / Multinoulli** | One of K mutually exclusive categories; WDL surface settlement. | [football-wdl-solution.md](./football-wdl-solution.md) |
| **Joint PDF / compound events** | Multi-dimensional joint, e.g. “home win AND goals>2.5”. MVP: **independent dual-pool + Indexer product**, labeled independence assumption. | [tier2-decision.md §2](./tier2-decision.md) |
| **Prior** | Initial parameters before pool creation or auction finalize (μ₀, α₀, λ₀). | Opening Auction |
| **Slippage** | Large trades move parameters so execution price exceeds theoretical PDF probability; primary LP revenue source. | [qa.md §LP](./qa.md) |
| **LUT (lookup table)** | Precomputed transcendental functions (e^−λ, erf) embedded in Move to save gas. | [on-chain-distribution-math.md §2.3](./on-chain-distribution-math.md) |

---

## 4. Contract types & positions

| Term | Definition | `contract_kind` |
| --- | --- | --- |
| **Interval** | Pay 1 USDC per share if outcome ∈ [a,b], else zero. | 0 |
| **Digital** | Pay if exact outcome hits (Poisson k, Dirichlet category, Normal threshold). | 1 |
| **Linear Call** | Payoff ∝ max(X−K, 0), discrete-slot approximation. | 2 |
| **Linear Put** | Payoff ∝ max(K−X, 0). | 3 |
| **Straddle** | Payoff ∝ \|X−K\|; buying pushes σ up — volatility long. | 4 |
| **Variance Swap** | Payoff ∝ (X−K)²; tail-vol sensitive. Phase 3, still Tier 1. | 5 |
| **Structured Note (capped call)** | min(max(X−K,0), C−K). | 6 |
| **Range Note** | Fixed coupon if X∈[L,U]. | 7 |
| **Barrier Note** | Fixed coupon if X≥B. | 8 |
| **Position** | User-owned object: contract type, range, entry probability, claim status. | `position.move` |
| **Strike K** | Reference level for option-like contracts (Normal uses tenths). | Trade panel |
| **claim** | After Oracle settlement, `claim_position` converts winning positions to USDC. | `settlement.move` |

---

## 5. AMM, LP & liquidity

| Term | Definition | Deep dive |
| --- | --- | --- |
| **MarketPool** | Shared AMM pool: vault, distribution params, status, LP Guard fields. | `market_pool.move` |
| **Vault** | Pool USDC balance; inflows from buys, outflows from claims/LP withdrawals. | — |
| **LP** | Liquidity provider depositing USDC for `LpShare`; earns slippage and losing-side principal, bears adverse selection. | [qa.md §LP](./qa.md) |
| **LpShare / LP Token** | LP share certificate (owned); redeemed at NAV. | `lp_token.move` |
| **NAV** | (vault cash − liability MTM) / lp_shares; basis for deposit/withdraw pricing. | [PRD §2.10](../PRD.md) |
| **L_mtm** | Mark-to-market worst-case payout of open positions; core input for NAV and Max-Loss. | `risk.move` |
| **Max-Loss check** | Before each `buy_*`: worst-case payout after trade ≤ Vault. | `risk.move` |
| **deposit_liquidity** | LP deposit: mint shares at NAV, scale α proportionally (Dirichlet) without changing marginals. | Phase 1.5 |
| **withdraw_liquidity** | LP redeem: burn shares × NAV. | Phase 2 |
| **Opening Auction** | Post-creation bidding: USDC into outcome buckets → `finalize` sets α₀/vault → Trading. | [qa.md](./qa.md) |
| **Round-Trip Churn** | Probability round-trips to origin; vault can still retain slippage premium. | [PRD §2.8](../PRD.md) |
| **T₀ / T₁ / T₂ entry timing** | T₀ early; T₁ mid-life expansion; T₂ deposit ban near expiry (`deposit_cutoff_bps`). | [qa.md](./qa.md) |
| **Pool Authority** | Address allowed to call `set_lp_guard_params`; Keeper must hold matching key. | [phase2-playbook.md](./phase2-playbook.md) |

---

## 6. LP Guard & risk

| Term | Definition | Field / module |
| --- | --- | --- |
| **LP Guard** | Phase 2 LP defense: dynamic fees, virtual liquidity, deposit cutoff, resolution window. | `lp_guard.move` |
| **fee_bps** | Pool **base** trading fee (set at creation). | `MarketPool` |
| **fee_multiplier_bps** | Dynamic **multiplier**; effective = `fee_bps × (10000 + mult) / 10000`. | `lp_guard::effective_fee_bps` |
| **deposit_cutoff_bps** | Fraction of lifecycle blocking LP deposits; 1000 bps = last 10%. | `assert_deposit_window_open` |
| **resolution_window_ts** | Seconds before maturity blocking `buy_*`. | `assert_buy_window_open` |
| **sigma_virtual_tenths** | Virtual σ; raised under risk to blunt the curve. | Keeper |
| **concentration_virtual** | Dirichlet virtual concentration defense. | Keeper |
| **paused** | Pool trading halted after Slash or emergency action. | `slash_pool` |
| **LP Guard Keeper** | Off-chain service polling pools and calling `set_lp_guard_params`. | `services/lp-guard-keeper/` |
| **Risk score (Keeper)** | 0.4×param drift + 0.35×skew + 0.25×volume EMA; max effective fee can reach 800 bps. | [phase2-playbook.md](./phase2-playbook.md) |
| **Cross-Margin** | `MarginAccount` aggregating multiple `Position` liabilities per address per pool. | `cross_margin.move` |
| **Slash** | On-chain penalty: seize pool collateral USDC, pause market, recovery timelock. | [slash-and-attestation.md](./slash-and-attestation.md) |
| **emergency_void / Voided** | Admin voids market (match cancelled, etc.); position refund + LP withdraw. | `emergency_cancel.move` |

---

## 7. Volatility

| Term | Definition | Deep dive |
| --- | --- | --- |
| **σ / sigma** | Uncertainty parameter; Normal uses `sigma_tenths`. | [qa.md §3](./qa.md) |
| **IV (implied volatility)** | Event-vol metric derived from σ and fees; not equity historical vol. | `IvPanel` |
| **Vol Crush** | σ collapse near expiry; Indexer writes `iv_history` for charts. | [p2-indexer-runbook.md](./p2-indexer-runbook.md) |
| **iv_history** | Indexer time series of σ, virtual σ, effective fees. | `GET /v1/pools/:id/iv-history` |

---

## 8. Oracle & settlement

| Term | Definition | Module |
| --- | --- | --- |
| **Macro Data Oracle** | Optimistic oracle for macro/sports: propose → liveness → optional committee → finalize. | `macro_oracle.move` |
| **DataFeed** | Registered oracle object per metric/market; holds `resolved_value` when finalized. | `macro_oracle` |
| **propose_data** | Proposer stakes and submits `claimed_value`. | — |
| **liveness** | Dispute window after proposal; dispute or auto-finalize. | default 24h |
| **ArbitrationCase** | Committee arbitration after dispute. | `oracle_arbitrator.move` |
| **resolved_value** | Final outcome; Poisson = goal count k, Normal = tenths slot, etc. | [oracle-playbook.md](./oracle-playbook.md) |
| **Oracle Relayer** | Off-chain auto finalize/nullify at maturity. | `services/oracle-relayer/` |
| **UMA DVM** | Optional external dispute resolution (`mock`/`live`). | `services/uma-dvm-relayer/` |
| **lock_time / maturity_ts** | Market expiry; anchor for Oracle settlement and prophet audit. | `MarketPool` |

---

## 9. Attestation, ZK & supervision

| Term | Definition | Deep dive |
| --- | --- | --- |
| **Attestation** | On-chain `proof_hash` + committee vote; **no** Groth16/Plonk verification in Move. | [slash-and-attestation.md](./slash-and-attestation.md) |
| **zk_coprocessor** | ZK supervision module: submit → attest → challenge window → finalize. | `zk_coprocessor.move` |
| **Brevis ZK Prover** | Off-chain real ZK; on-chain still Attestation registration. | `services/brevis-zk-prover/` |
| **Hot path / cold path** | `buy_*` is hot (Tier 1 atomic); ZK/Attestation is cold supervision, non-blocking. | [phase3-playbook.md](./phase3-playbook.md) |

---

## 10. SuiProphet

| Term | Definition | Deep dive |
| --- | --- | --- |
| **Prophet** | Analyst submitting predictions for a `market_id`; track record audited post-Oracle. | [prophet-playbook.md](./prophet-playbook.md) |
| **PrivateProphecy** | Single prediction object: encrypted blob, hash, unlock_price, paid_buyers. | `prophet_registry.move` |
| **ProphetStats** | On-chain wins/losses/cheats/score_bps — **source of truth** for ranking. | `prophet_leaderboard.move` |
| **Prophet Score (score_bps)** | Composite score out of 10000; paid unlock requires ≥4000. | [business-spec.md §2.2](./business-spec.md) |
| **Seal** | Mysten conditional decrypt: paid ∥ after lock_time ∥ public. | [prophet-market-and-encryption-guide.md](./prophet-market-and-encryption-guide.md) |
| **audit_prophecy** | Post-settlement plaintext hash check → WIN/LOSS/CHEAT. | — |
| **CHEAT** | Audit fraud flag; permanent loss of paid-unlock eligibility. | — |

---

## 11. On-chain objects

| Term | Type | Notes |
| --- | --- | --- |
| **GlobalConfig** | shared | Protocol-wide config |
| **AdminCap** | owned | Admin capability |
| **MarketPool** | shared | AMM pool |
| **Position** | owned | User position |
| **LpShare** | owned | LP share |
| **DataFeed** | shared | Oracle feed |
| **EventRoot** | shared | Market root (Phase 4) |

---

## 12. Off-chain services

| Service | Port (typical) | Role |
| --- | --- | --- |
| **Indexer** | 8800 | Postgres + REST: discovery, IV, leaderboard, GMV, prophet blobs |
| **Gas Station** | 8787 | Sponsored SUI gas (dual-signature) |
| **LP Guard Keeper** | 8788 | Auto LP Guard params |
| **Oracle Relayer** | — | Auto finalize/nullify |
| **Brevis ZK Prover** | — | proof_hash → Attestation |

---

## 13. Market lifecycle

| Status | Value | Meaning |
| --- | --- | --- |
| **Auction** | 0 | Opening auction; no `buy_*` |
| **Trading** | 1 | Active trading |
| **Settled** | 2 | Oracle resolved; claimable |
| **Voided** | 3 | Emergency void; refund/redeem |

---

## 14. App & protocol

| Term | Definition |
| --- | --- |
| **PTB** | Programmable Transaction Block; Gas Station assembles and dual-signs. |
| **Sponsored Transaction** | Gas paid by `gasOwner` (Gas Station wallet). |
| **GMV** | Gross merchandise volume aggregated by Indexer. |
| **GeoBlock** | Frontend IP country block; does **not** block direct on-chain access or replace KYC. |
| **Non-custodial** | User assets in own wallet and on-chain objects. |

---

## 15. Governance

| Term | Definition |
| --- | --- |
| **Governance param sign-off** | Dual review locking mainnet baselines for LP Guard, Slash, protocol fee. |
| **Protocol fee** | Prophet unlock revenue share; default 500 bps (5%). |

See [mainnet-governance-params.md](./mainnet-governance-params.md).

---

## 16. Easily confused

| A | B | Difference |
| --- | --- | --- |
| Tier 1 | Tier 2 | Single-var on-chain atomic vs joint PDF optimistic off-chain |
| Tier 2 | Phase 3 notes | Variance Swap etc. remain Normal + Tier 1 |
| PDF | On-chain math | On-chain computes pricing quantities, not full density |
| IV | Equity IV | Event-driven σ from information flow |
| Oracle | AMM pricing | Oracle **settles only**; must not update λ/μ/σ |
| Attestation | On-chain ZK | Move has no native verifier; hash + committee |
| Indexer rank | ProphetStats | Truth on-chain; Indexer is cache |
| LP Guard | Slash | Daily dynamic defense vs major penalty |
| GeoBlock | KYC | Frontend geo only |

---

## Index

**A** Attestation · Auction · AdminCap  
**B** Barrier Note · Beta · bps · Brevis  
**C** CDF · CHEAT · claim · Cross-Margin  
**D** DataFeed · Digital · Dirichlet · Disputer  
**E** EventRoot · emergency_void  
**F** fee_bps · fee_multiplier_bps · finalize_auction  
**G** Gas Station · GeoBlock · GMV  
**I** IV · Interval · Indexer  
**L** LP · LP Guard · lock_time  
**M** Macro Oracle · MarketPool · maturity_ts  
**N** NAV · Normal  
**O** Opening Auction · Oracle  
**P** PDF · PMF · Poisson · Position · Prophet · PTB  
**Q** Q32.32 · quorum  
**R** Range Note · resolved_value · ROI  
**S** Seal · Slash · Skellam · Straddle · sigma  
**T** tenths · Tier 1/2 · Trading  
**U** UMA DVM · USDC  
**V** Vault · Variance Swap · Vol Crush · Voided  
**Z** zk_coprocessor

---

## Changelog

| Date | Version | Notes |
| --- | --- | --- |
| 2026-06-19 | v1.0 | Initial full-system glossary |
