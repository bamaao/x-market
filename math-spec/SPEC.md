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

# @x-market/math-spec — Tier 1 On-Chain Math Engine Specification

**English** | [简体中文](./SPEC.zh.md)

> **Version:** v1.0  
> **Date:** 2026-05-25  
> **Scope:** Solana (Anchor) · Sui (Move)  
> **Parent doc:** [../PRD.md](../PRD.md) §3

Both chains must implement **semantically equivalent** math behavior. On-chain programs are the sole source of truth; off-chain Preview Engine must pass all test vectors in this spec.

---

## 1. Design Principles

1. **Bounded inputs:** All functions must `require!` boundary checks before invocation; out-of-bounds reverts.
2. **Fixed-point only:** No floating-point on-chain; uniformly use `Q32.32` (see §2).
3. **Determinism:** Same input → same output, bit-exact across chains (output allows ±1 ULP tolerance, see §2.4).
4. **O(1) priority:** Factorials and low-order powers via lookup tables; Taylor iterations have fixed upper bounds.
5. **Oracle must not participate in Tier 1 pricing:** All functions in this spec are pure on-chain calls.

---

## 2. Fixed-Point Format `Q32.32`

### 2.1 Representation

```
Type: unsigned U128 (signed scenarios use I128 two's complement; ranges per function)
Scale: SCALE = 2^32 = 4_294_967_296
Encoding real value x: x_fp = round(x * SCALE)
Precision: ~9.3 decimal digits (meets 10^-9 relative error target)
```

### 2.2 Basic Operations

| Operation | Formula | Notes |
| --- | --- | --- |
| Multiply | `(a * b) >> 32` | Intermediate uses U256 / u128 widening |
| Divide | `(a << 32) / b` | b = 0 → revert |
| Add / Subtract | Direct ± | Overflow → revert |
| Compare | Integer compare | — |

### 2.3 Constant Encoding

```rust
// Example: e ≈ 2.718281828459045
const E_FP: u128 = 11_734_907_089_846_289_754; // round(e * 2^32)

// π, ln(2), etc. precomputed and embedded likewise
```

Solana uses `u128` + manual widening; Sui uses `u128` or `u256` extension library. **Constant bit values must match this spec.**

### 2.4 Tolerance

| Scenario | Tolerance |
| --- | --- |
| Probability output P ∈ [0, 1] | `\|P_chain - P_ref\| ≤ 1e-9` |
| Parameters λ, μ, σ | `\|Δ\| ≤ 1e-8` (absolute) |
| Cross-chain comparison | **±1 ULP** allowed (Q32.32 least significant bit) |

---

## 3. Static Lookup Tables

### 3.1 Factorial Table `FACTORIAL_LUT`

`FACTORIAL[n] = n!`, n = 0..14, Q32.32 encoded:

| n | n! (real value) | Use |
| --- | --- | --- |
| 0 | 1 | Poisson, Taylor |
| 1 | 1 | |
| … | … | |
| 14 | 87,178,291,200 | Upper bound fallback |

**On-chain:** Read-only static array, length 15, embedded at compile time.

### 3.2 Integer Power LUT `POW_LUT`

Precompute Taylor term denominators `λ^k / k!`, or compute `λ^k` on demand via fast exponentiation (k ≤ 14, at most 4 squarings).

**Recommended:** Inline Taylor expansion computing `λ^n / n!`, n = 0..8, using `FACTORIAL_LUT[n]` as divisor.

### 3.3 Exponential `exp_neg(λ)` — Precomputed LUT (recommended)

Taylor 8th order at λ=8 still has error > 1e-3, **not meeting** full-interval $10^{-9}$ requirement. Production uses **static LUT** for $\lambda \in [0, 8]$:

| Property | Value |
| --- | --- |
| Step size | 0.01 |
| Grid points | 801 (index 0..800) |
| Encoding | `EXP_NEG_LUT[i] = round(e^{-i/100} * SCALE)` |
| Lookup | `i = round(λ * 100)`, optional linear interpolation |

```rust
fn exp_neg(λ_fp: u128) -> u128 {
  let idx = (λ_fp * 100 / SCALE).clamp(0, 800);
  EXP_NEG_LUT[idx as usize]
}
```

**Optional (save space at low λ):** Use Taylor 14th order when λ ≤ 3 (error < 1e-9), LUT when λ > 3 — both chains must pick one and cover in spec test vectors.

**Forbidden:** Using only 8th-order Taylor across full interval [0, 8].

---

## 4. Poisson Distribution

### 4.1 Bounds

| Parameter | Range | Notes |
| --- | --- | --- |
| `λ` | [0, 8] | Expected goals; Q32.32 |
| `k` | [0, 14] | Discrete outcome |
| `a, b` | Integer interval | Interval probability P(a ≤ X ≤ b) |

### 4.2 Point Mass

$$
P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}
$$

```
poisson_pmf(λ_fp, k: u8) -> u128:
  require k <= 14
  require λ_fp <= LAMBDA_MAX_FP   // 8.0

  pow_k  = pow_lambda(λ_fp, k)    // λ^k
  exp_n  = exp_neg_lut(λ_fp)      // e^(-λ) via LUT
  fact_k = FACTORIAL_LUT[k as usize]

  // P = λ^k * e^(-λ) / k!
  num = (pow_k * exp_n) >> 32
  return (num << 32) / fact_k
```

### 4.3 Interval Probability

```
poisson_interval(λ_fp, a: u8, b: u8) -> u128:
  require a <= b
  require b <= 14
  sum = 0
  for k in a..=b:
    sum += poisson_pmf(λ_fp, k)
  return min(sum, ONE_FP)
```

### 4.4 Tail Probability

```
poisson_tail(λ_fp, k_min: u8) -> u128:   // P(X >= k_min)
  return ONE_FP - poisson_interval(λ_fp, 0, k_min - 1)
```

### 4.5 Parameter Update (buying "over")

User pays `amount_usdc`, buying interval [a, b]. Goal: find new λ' such that:

```
poisson_interval(λ', a, b) = target_prob
target_prob = f(amount, pool_state)   // determined by AMM invariant
```

**Algorithm:** Bounded binary search (max 32 steps) or Newton iteration (max 5 steps + fallback to binary).

```
update_lambda_buy(λ_fp, a, b, delta_prob_fp) -> λ_new_fp:
  target = min(λ_fp_interval(a,b) + delta_prob_fp, ONE_FP)
  λ_new = binary_search_lambda(a, b, target, λ_fp)
  require λ_new <= LAMBDA_MAX_FP
  return λ_new
```

**Newton (optional acceleration, must fallback to binary):**

```
f(λ) = poisson_interval(λ, a, b) - target
f'(λ) ≈ [f(λ+ε) - f(λ-ε)] / (2ε)   // numerical derivative, ε = 1e-6
λ ← λ - f/f', clamp [0, 8], max 5 steps
```

### 4.6 Max-Loss Bounded Checking

Before each Poisson interval buy, on-chain computes **worst-case single-point** total payout:

```
payout_i = stake * 1e9 / entry_prob_ppb   // digital-option style
liability(k) = Σ payout_i  for all open positions covering outcome k
require max_k liability(k) ≤ vault + incoming_stake
```

- `liability_by_k` length 15 (k ∈ [0,14]), accumulated after each trade
- Violation reverts `MaxLossExceeded`

### 4.7 Additional Liquidity (Global Scaling)

**Dirichlet:** $\alpha'_i = \alpha_i \cdot (V_{\text{after}} / V_{\text{before}})$, $p_i$ unchanged.

**Poisson:** MVP phase adding USDC **does not change** $\lambda$ (only thickens Vault / Max-Loss capacity); concentration scaling formula finalized in Phase 2.

---

## 5. Dirichlet Distribution

### 5.1 Bounds

| Parameter | Range |
| --- | --- |
| `α_i` | [α_min, α_max] = [1e-6, 1e12] (Q32.32) |
| Categories `K` | [2, 16] |

### 5.2 Probability

$$
p_i = \frac{\alpha_i}{\sum_j \alpha_j}
$$

```
dirichlet_prob(alphas: &[u128], i: usize) -> u128:
  sum = alphas.iter().sum()
  require sum > 0
  return (alphas[i] << 32) / sum
```

### 5.3 Concentration Parameter ("volatility" proxy)

```
concentration = sum(alphas)
```

- Higher concentration → smaller per-trade impact on p_i
- Frontend IV proxy: `vol_proxy = 1 / concentration`

### 5.4 Parameter Update (buy category i)

```
update_dirichlet_buy(alphas, i, stake_fp) -> alphas':
  alphas'[i] = alphas[i] + stake_fp * CONCENTRATION_SCALE
  // stake_fp linearly maps to USDC amount; coefficient from pool fee model
  return alphas'
```

**No iteration:** Dirichlet update is analytic addition, O(K).

---

## 6. Normal Distribution (Bounded Tier 1)

### 6.1 Bounds (declared at market creation, stored in Pool)

| Parameter | Default range |
| --- | --- |
| `μ` | [μ_min, μ_max] per market config |
| `σ` | [σ_min, σ_max], recommend σ ∈ [0.001, 100] |

### 6.2 CDF — Error Function Taylor

$$
\Phi(x) = \frac{1}{2}\left(1 + \mathrm{erf}\left(\frac{x-\mu}{\sigma\sqrt{2}}\right)\right)
$$

**erf approximation (Abramowitz & Stegun 7.1.26, or 9th-order Taylor):**

```
erf(z_fp) -> u128:
  // valid when |z| <= 6; beyond that ±1
  // use Horner polynomial; coefficients in test-vectors.json constants.erf_coeffs
```

### 6.3 Interval Probability

```
normal_interval(μ_fp, σ_fp, a_fp, b_fp) -> u128:
  za = (a_fp - μ_fp) / σ_fp / SQRT2_FP
  zb = (b_fp - μ_fp) / σ_fp / SQRT2_FP
  return (erf(zb) - erf(za) + 2*ONE_FP) >> 1   // normalized to [0,1]
```

**Alternative (better Gas):** Precompute 2D CDF LUT on discrete `(μ, σ)` grid; grid density chosen at market creation; Phase 1 uses Taylor first, switch after benchmark.

### 6.4 Parameter Update

- **Directional (buy [a,b]):** Increase μ toward interval center + optional σ tweak; binary/Newton same as Poisson.
- **Straddle (buy extremes):** Increase σ, μ unchanged; `σ_new = σ + f(stake)` analytic or 1D search.

---

## 7. Beta Distribution (Bounded Proportion, Phase 1 Optional)

| Parameter | Range |
| --- | --- |
| `α, β` | [1e-4, 1e6] |
| Support x | [0, 1] |

**MVP simplification:** Approximate with Dirichlet(α, β) two-class, or precompute subset of 3D LUT `(α, β, x)`.

Full Beta CDF on-chain marked **Phase 1.5**, does not block Poisson/Dirichlet/Normal launch.

---

## 8. Market Type → Function Mapping

| Market type | Distribution | Pricing function | Update function |
| --- | --- | --- | --- |
| Football goals | Poisson | `poisson_interval` / `poisson_tail` | `update_lambda_buy` |
| Win/draw/loss | Dirichlet | `dirichlet_prob` | `update_dirichlet_buy` |
| CPI / TPS | Normal | `normal_interval` | `update_normal_mu` / `update_normal_sigma` |
| Vote share | Beta / Dirichlet | Same as above | Same as above |

---

## 9. Composite Events (MVP)

**Independent pools + joint display API (off-chain Indexer):**

```
P(Win AND goals > 2.5) ≈ p_win * poisson_tail(λ, 3)
```

On-chain **does not** implement joint PDF; frontend/Indexer reads two Pool states separately and multiplies, labeled "independence assumption".

---

## 10. On-Chain Integration Interface

### 10.1 Solana (Rust)

```rust
pub mod math {
    pub fn poisson_pmf(lambda: u128, k: u8) -> Result<u128>;
    pub fn poisson_interval(lambda: u128, a: u8, b: u8) -> Result<u128>;
    pub fn update_lambda_buy(/* ... */) -> Result<u128>;
    pub fn dirichlet_prob(alphas: &[u128], i: usize) -> Result<u128>;
    pub fn normal_interval(mu: u128, sigma: u128, a: u128, b: u128) -> Result<u128>;
}
```

### 10.2 Sui (Move)

```move
module x_market::fixed_point { /* Q32.32 ops */ }
module x_market::poisson { public fun pmf(...): u128 }
module x_market::dirichlet { public fun prob(...): u128 }
module x_market::normal { public fun interval(...): u128 }
```

---

## 11. Testing Requirements

1. **Unit tests:** Each public function covers boundary, typical, extreme values.
2. **Cross-chain consistency:** Same input, Solana vs Sui output diff ≤ 1 ULP.
3. **Reference implementation:** `math-spec/reference/` Rust crate, f64 double-precision reference.
4. **CI:** Math module changes must run full `test-vectors.json`.

Run reference verification (after crate implementation):

```bash
cd math-spec/reference
cargo test
cargo run --bin verify_vectors -- ../test-vectors.json
```

---

## 12. Performance Budget

| Operation | Solana CU target | Sui Gas target |
| --- | --- | --- |
| `exp_neg_lut` single | < 500 | TBD after benchmark |
| `poisson_pmf` single | < 3,000 | TBD after benchmark |
| `poisson_interval` (width≤5) | < 12,000 | TBD after benchmark |
| `update_lambda_buy` | < 80,000 | TBD after benchmark |
| `dirichlet_prob` (K=3) | < 2,000 | TBD after benchmark |
| `normal_interval` | < 25,000 | TBD after benchmark |

Exceeding budget → optimize LUT or reduce iterations (must re-verify precision).

---

## 13. Document Index

| File | Description |
| --- | --- |
| [SPEC.md](./SPEC.md) | This specification |
| [test-vectors.json](./test-vectors.json) | Cross-chain test vectors |
| [../PRD.md](../PRD.md) | Product overview |
| [../docs/qa.md](../docs/qa.md) | Technical research |

---

*Both chains deploy independently; math behavior must be equivalent.*
