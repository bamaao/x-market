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

**English** | [简体中文](./tier2-decision.zh.md)

# Tier 2 Model Necessity Decision

> **Version:** v1.0 · **Date:** 2026-06-08  
> **Status:** Decided  
> **Related:** [PRD.md](../PRD.md) §3.6 · [math-spec/SPEC.md](../math-spec/SPEC.md) §9 · [docs/qa.md](./qa.md) §Tier 1/2 · [phase3-playbook.md](./phase3-playbook.md) §4 · [slash-and-attestation.md](./slash-and-attestation.md) · [deferred-features.md](./deferred-features.md)

---

## Decision Summary

**Do not adopt the Tier 2 model in the current phase (Testnet → mainnet → first 6–12 months of growth).**

Focus fully on the **Tier 1 on-chain math engine** (Poisson / Dirichlet / Normal) and the existing structured notes, LP defense, Oracle, and SuiProphet ecosystem. `zk_coprocessor` is not wired into the `buy_*` hot path; the **async Brevis supervision line** is already implemented in `services/brevis-zk-prover/` (mock/live, optional for institutional compliance).

---

## 1. Terminology Clarification

Within the project, **Tier 2 ≠ Phase 3 structured products**.

| Concept | Meaning | On-chain pricing |
| --- | --- | --- |
| **Tier 1** | Single-variable PDF; parameter updates and integration atomically in Move | ✅ Hot path |
| **Tier 2** | Multi-dimensional / joint PDF; Taylor / LUT too heavy on-chain; off-chain optimistic pricing + async supervision | Off-chain optimistic + Attestation / ZK cold path |
| **Phase 3 notes** | Variance Swap, Structured / Range / Barrier Note | **Still Normal + Tier 1** |

Common misconception: Variance Swap and other Phase 3 capabilities are live, but they do not trigger Tier 2; only **joint high-dimensional PDFs** require Tier 2 architecture (see [qa.md](./qa.md) §Tier 2).

---

## 2. Tier 1 Coverage

| Scenario | Tier 1 approach | Implementation status |
| --- | --- | --- |
| Soccer goals | Poisson | ✅ |
| Win/draw/loss / elections | Dirichlet | ✅ |
| CPI / BTC / TPS | Normal | ✅ |
| Digital / range / Call / Put / Straddle | All three distributions | ✅ |
| Variance / Structured / Range / Barrier | Normal derivatives | ✅ |
| Vote share [0, 1] | Dirichlet approximates Beta ([SPEC.md](../math-spec/SPEC.md) §7) | ✅ Spec finalized |
| "Home win AND goals > 2.5" | **Independent dual-pool + Indexer multiplication** ([SPEC.md](../math-spec/SPEC.md) §9) | ✅ MVP path |

Seed markets (`app/src/lib/markets.ts`) are Poisson / Dirichlet / Normal pools; the full product loop runs without Tier 2.

---

## 3. Why Tier 2 Is Not Needed Now

### 3.1 Demand

Most prediction markets are single-variable or pool-splittable events. math-spec is explicit:

> On-chain **does not** implement joint PDFs; frontend / Indexer reads two Pool states separately and multiplies, labeled with "independence assumption".

The independence assumption is usually acceptable for mainstream sports / macro scenarios; strongly correlated joint distributions are long-tail demand.

### 3.2 Engineering

Tier 2 adds extra ops and trust cost:

- Off-chain compute nodes + verification committee + challenge / slash dispute handling
- `zk_coprocessor` **not yet wired** into `pool::buy_*` hot path
- Brevis off-chain Prover Keeper integrated (`services/brevis-zk-prover/`); on-chain remains Attestation transition layer, pending Sui native verifier (see [phase3-playbook.md](./phase3-playbook.md) §4.5)
- Trust model shifts from "on-chain verifiable" to "optimistic execution + post-hoc accountability"

Mainnet blockers (external audit, governance sign-off, emergency drill) are not complete; Tier 2 would dilute focus.

### 3.3 Performance

Parametric AMM hot path requires: **atomic update of μ / σ / λ / α within a single transaction**.

| Approach | Latency | Suitable for transaction hot path |
| --- | --- | --- |
| Tier 1 on-chain fixed-point | Milliseconds | ✅ |
| Attestation (hash + quorum) | Milliseconds–seconds | ✅ |
| ZK proof generation + on-chain verify | Seconds–minutes; Move has no native precompile | ❌ |

Tier 1 millisecond atomic, zero external dependency is a core engineering advantage; Tier 2 trades compute for verifiability and should not replace the main path. See [qa.md](./qa.md) §Tier 1/2 comparison.

### 3.4 Business

PRD §7 KPIs (seed markets, weekly active users, TVL) do not depend on Tier 2. Tier 2 targets long-term institutional AUM / complex derivatives; not an MVP blocker.

---

## 4. Other Deferred Items (Beta · UMA DVM · Normal Auction)

**Tier 1 extensions / Oracle governance** gaps unrelated to Tier 2 but planned in PRD — see [deferred-features.md](./deferred-features.md). Normal auction and UMA DVM adapter are implemented; still non-blocking before mainnet: Beta CDF.

---

## 5. Role of Attestation and ZK (Supplement)

If Tier 2 **is enabled in the future**, the supervision line may use Attestation or async ZK; both **do not block transactions**:

- **Attestation + challenge constraints:** Performance sufficient for hot-path registration; trust depends on verification committee + slash (same model as Macro Oracle); see [slash-and-attestation.md](./slash-and-attestation.md)
- **True ZK (Brevis, etc.):** Cryptographic verifiability; suitable for async audit / institutional compliance only, not real-time quoting

Current `zk_coprocessor` is an Attestation transition layer; **not** equivalent to on-chain Groth16 / Plonk verification. Main path does not depend on ZK; true ZK is an institutional long-tail upgrade.

---

## 6. When to Re-evaluate Tier 2

Start a Tier 2 project review when **at least one** of the following applies:

| Trigger | Example |
| --- | --- |
| Strong correlation cannot be approximated independently | "Rate cut magnitude × unemployment rate" joint distribution; dual-pool multiplication error affects pricing |
| Single-pool capital efficiency required | Institution requires one Vault for multi-dimensional exposure |
| PDF intractable on-chain | Multi-dimensional Gaussian, copula, dynamic correlation matrix |
| Compliance explicitly requires | Counterparty rejects Attestation, requires validity proof |
| Liquidity fragmentation bottleneck | Independent pool approach causes unacceptable slippage / TVL fragmentation |

Reference threshold ([mainnet-infra-priority.md](./mainnet-infra-priority.md)): before active markets > 50 or Prophet predictions > 200, these conditions usually are not real pain points.

---

## 7. Recommended Roadmap

```
Now ~ 6–12 months post-mainnet
  ├── Full focus Tier 1: three distributions + structured notes + LP defense + Oracle + Prophet
  └── Composite events: independent dual-pool + Indexer display, UI labeled "independence assumption"

When triggers are met
  ├── First evaluate Tier 1 extensions (more Normal pools, off-chain Copula preview)
  ├── Still insufficient → Tier 2 optimistic execution + Attestation supervision
  └── Institutional compliance pressure → async ZK audit line (still non-blocking for transactions)

Explicitly not doing
  ├── Adopt multi-dimensional joint PDF early for "architectural completeness"
  └── Integrate Brevis just to integrate Brevis
```

**`zk_coprocessor`:** Keep module and governance flow; do not wire into `buy_*`; do not block mainnet launch.

---

## 8. Conclusion Reference

| Question | Answer |
| --- | --- |
| Adopt Tier 2 for mainnet? | **No** |
| Can MVP run without Tier 2? | **Yes**, and by design |
| Is Tier 2 the wrong direction? | No, it is a **long-term option** |
| Current priority? | Tier 1 ops, mainnet launch, liquidity, Oracle, Prophet |

---

## Change Log

| Date | Version | Notes |
| --- | --- | --- |
| 2026-06-08 | v1.0 | Initial: decision not to adopt Tier 2; clarify Tier 1/2 boundary and Attestation/ZK division |
| 2026-06-08 | v1.1 | Added §4 deferred items index, link [deferred-features.md](./deferred-features.md) |
