**English** | [简体中文](./poisson-lambda-guide.zh.md)

# Poisson Pool Parameter λ (tenths) — Setup Guide

> **Date:** 2026-06-19  
> **Context:** How to set `lambda_tenths` when creating a Poisson prediction market, with World Cup goal examples.

---

## 1. What is λ (tenths)?

`lambda_tenths` is the core Poisson pool parameter, stored as an **integer** in tenths:

```
actual λ = lambda_tenths / 10
```

| Example tenths | Actual λ | Meaning |
|----------------|----------|---------|
| 25 | 2.5 | Expected 2.5 goals per match |
| 30 | 3.0 | Expected 3.0 goals per match |
| 15 | 1.5 | Expected 1.5 goals per match |

On-chain it lives in `MarketPool.lambda_tenths` (`u16`) and converts to Q32.32 fixed-point:

```move
// sources/math/fixed_point.move
public fun from_tenths(v: u64): u128 {
    from_u64(v) / 10
}
```

### Valid range

| Item | Value |
|------|-------|
| On-chain upper bound | **80** → λ ∈ [0, 8.0] |
| Frontend create validation | **1–80** (must be > 0) |
| Product default example | **25** (λ = 2.5) |
| Settlement outcome | **slot 0–14** (single-match total goals k ≤ 14) |

---

## 2. Three ways to set λ

### 2.1 Manual at Trading pool creation

The creator calls `create_poisson_pool` or `create_poisson_pool_with_feed` and passes `lambda_tenths` directly:

```move
// sources/pool.move
public entry fun create_poisson_pool(
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    if (lambda_tenths > 80) {
        abort errors::out_of_bounds()
    };
    // ...
}
```

- Frontend create page defaults to `"25"`, validated in range 1–80
- Config examples such as `deploy/testnet.json`: `lambdaTenths: 25`

### 2.2 Auction calibration

When the initial λ is uncertain, use the auction discovery flow:

1. `start_poisson_auction` → initial `lambda_tenths = 0`
2. Users bid USDC into 3 buckets (`auction_bid`):

   | Bucket index | Meaning | Implied λ |
   |--------------|---------|-----------|
   | 0 | Low scoring | ≈ 1.5 |
   | 1 | Medium | ≈ 2.5 |
   | 2 | High scoring | ≈ 5.0 |

3. After the auction, `finalize_poisson_auction` sets λ via weighted average:

```
λ_tenths = (15 × b₀ + 25 × b₁ + 50 × b₂) / (b₀ + b₁ + b₂)
```

Weights 15 / 25 / 50 correspond to 1.5 / 2.5 / 5.0; result capped at 80.

### 2.3 Dynamic update on trade

After a user buys an interval or digital contract, λ adjusts automatically:

```
delta_prob = stake / (vault + stake)
target     = P(λ, [a,b]) + delta_prob
λ'         = binary search on [0, 80] s.t. poisson_interval(λ', a, b) ≥ target
```

- Buying “over” / high intervals pushes λ up
- Adding LP liquidity **does not** change λ (only thickens the vault)

---

## 3. What λ is used for

| Use | Description |
|-----|-------------|
| **Pricing** | `buy_poisson_interval` / `buy_poisson_digital` use current λ for `poisson_interval` / `poisson_pmf` |
| **Display** | Frontend shows `(lambdaTenths / 10).toFixed(1)`, e.g. “λ = 2.5 goals/match” |
| **Settlement** | Oracle writes `resolved_value` (k ∈ 0–14); independent of λ |

---

## 4. World Cup goals: define scope first

**Key constraint:** Poisson pools apply to **single-match** total goals (0–14), **not** tournament-wide totals (~150–180 goals).

| Prediction target | Model | Parameters |
|-------------------|-------|------------|
| **One match** total goals (0–14) | **Poisson** | `λ (tenths)` |
| **Full tournament** total goals (≈150–180) | **Normal wide** | `mu_units` / `sigma_units` |
| Team / stage goals | Depends on scale | Poisson or Normal |

On-chain limits:

- Poisson: `k ∈ [0, 14]`, `λ ≤ 8.0`
- Tournament total ≈ 170 → **outside Poisson modeling range**

---

## 5. Scenario A: Single World Cup match total goals

### Setup formula

```
λ (tenths) = expected goals per match × 10
```

### Rule-of-thumb values

| Scenario | Expected λ | Suggested tenths |
|----------|------------|------------------|
| Regular league / group stage | 2.4–2.7 | **24–27** |
| Product default | 2.5 | **25** |
| Attacking, high-scoring possible | 2.8–3.2 | **28–32** |
| Defensive, 0–0 common | 2.0–2.3 | **20–23** |
| World Cup final (conservative) | 2.2–2.6 | **22–26** |

### Example

Market: “France vs Argentina — full-time total goals”

- Expected **2.6 goals/match** → set **`26`** at creation
- Frontend shows **λ = 2.6 goals/match**
- Users can buy intervals like `[2,3]`, digital `k=4`, etc.
- Oracle settlement: actual match total goals (0–14)

### When initial λ is uncertain

Use `start_poisson_auction`; the market calibrates λ from weighted bucket deposits.

---

## 6. Scenario B: Full tournament total goals

Use a **Normal wide pool** (`create_normal_pool_wide`). **Do not** use Poisson `λ (tenths)`.

```move
// sources/pool.move
public entry fun create_normal_pool_wide(
    mu_units: u64,
    sigma_units: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
)
```

### Suggested parameters (48 teams, ~104 matches)

| Parameter | Meaning | Suggested value |
|-----------|---------|-----------------|
| `mu_units` | Expected total goals | **165–175** (2018≈169, 2022≈172) |
| `sigma_units` | Uncertainty | **12–20** |

### Example

- Expected total **172** → `mu_units = 172`
- 95% band roughly 140–200 → `sigma_units ≈ 15`
- Users buy intervals such as `[160, 180]`
- Oracle settlement writes actual total goals (integer units)
- Title must state clearly: “2026 World Cup — total goals across all matches”

---

## 7. Scenario C: World Cup theme + Poisson

If you want Poisson specifically:

- Create a **separate Poisson pool per match** (each with its own λ)
- Or a **single-match** market such as “final total goals”

---

## 8. Quick reference

| Scenario | Model | Parameter setup |
|----------|-------|-----------------|
| Direct Trading pool | Poisson | Pass `lambda_tenths` in create tx (e.g. 25) |
| Uncertain initial λ | Poisson Auction | Weighted 3-bucket USDC → `finalize_poisson_auction` |
| Existing Trading pool | Poisson | Each buy auto `update_lambda_buy` |
| Single World Cup match | Poisson | `λ (tenths)` = expected per match × 10; typical **25–28** |
| Full tournament total | Normal wide | `mu_units ≈ 170`, `sigma_units ≈ 15` |

---

## 9. One-line summary

- **Single-match goals** → Poisson; `λ (tenths)` = expected goals per match × 10; World Cup matches often **25–28**
- **Full tournament total** → Normal wide `mu_units` (≈ **170**); **do not** set `λ (tenths)`

---

## Related code and docs

| Path | Description |
|------|-------------|
| `sources/math/poisson.move` | Poisson PMF, interval prob, λ update, auction calibration |
| `sources/pool.move` | Pool create, buy, auction entrypoints |
| `sources/market_pool.move` | `MarketPool.lambda_tenths` field |
| `math-spec/SPEC.md` §4 | Poisson math spec |
| `app/src/lib/markets.ts` | Seed market example `lambda_tenths: 25` |
| `PRD.md` §2.8.1 | Football goal interval settlement example |
