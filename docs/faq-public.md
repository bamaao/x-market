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

# X-Market Public FAQ (Short Version)

**English** | [简体中文](./faq-public.zh.md)

> Short Q&A for website, social media, and demos.  
> For engineering details, see `PRD.md`, `docs/qa.md`, and phase playbooks.

---

## 1) How are you different from traditional Yes/No prediction markets?

We don't split every outcome into many fragmented order books. A parametric AMM makes markets directly on probability distributions.  
In short: traders trade the **probability curve**, not a race for binary tokens.

---

## 2) How is a discrete event like total football goals priced?

With a Poisson model (core parameter `lambda`).  
For example, buying interval `[2,6]`, the system computes `P(2<=X<=6)` as the theoretical price, then adds slippage for the actual fill.

---

## 3) I bought `[2,6]` and the final score is 5 goals — how is payout calculated?

Settlement is straightforward:

- Hit the interval: each position pays 1 USDC
- Miss the interval: position goes to zero

Example:

- Invest 1000 USDC
- Average cost with slippage: 0.70
- Position size = `1000 / 0.70 = 1428.57` units
- If result `X=5` (hit), total payout `1428.57 USDC`
- Net profit `+428.57 USDC`, ROI ~`42.86%`

---

## 4) Isn't a very wide interval like `[1,7]` almost guaranteed to win?

Wide intervals are usually "easier to hit" but also **more expensive**.  
So the typical structure is not huge upside, but:

- High win rate
- Low odds
- Tail risk: one miss can wipe prior gains

Typical pattern: small wins often, occasional large drawdown or loss.

---

## 5) Will LPs lose money long term?

LP returns mirror traders:

- Frequent small losses (when positions hit)
- Infrequent large gains (when tail events miss, vault keeps principal)

Whether long-term expectancy is positive depends on four things:

1. Whether turnover is high enough  
2. Whether slippage/fees cover tail payouts  
3. Tail event frequency  
4. Whether risk controls work (dynamic fees, virtual liquidity, time locks)

---

## 6) What risk defenses do you have?

- Max-Loss boundary checks (prevent insolvency)
- LP Guard (dynamic fees, virtual liquidity, time-window constraints)
- Cross-Margin risk aggregation
- Phase 3: ZK coprocessor interface and Slash risk controls

---

## 7) What new products does Phase 3 add?

Normal markets now support:

- Variance Swap
- Structured Note (capped call)
- Range Note (range coupon)
- Barrier Note (barrier coupon)

---

## 8) X-Market in one sentence

X-Market upgrades "prediction markets" into **probability-distribution derivative markets**:  
you trade not just direction, but intervals, volatility, and structured risk.
