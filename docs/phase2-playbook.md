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

**English** | [简体中文](./phase2-playbook.zh.md)

# X-Market Sui Phase 2 Playbook

This guide walks through Phase 2 advanced features end-to-end on **Sui Testnet**:

- **LP Guard (defensive mechanisms)**: dynamic fees, virtual liquidity, T2 deposit cutoff, settlement timelock
- **LP redemption**: `withdraw_liquidity` (burn LpShare at NAV, withdraw USDC)
- **Advanced derivatives**: linear options (Linear Call/Put), Straddle
- **Capital efficiency**: on-chain Cross-Margin ledger and frontend portfolio VaR estimate

---

## 1. LP Guard (defensive mechanisms) configuration

Phase 2 adds multiple defensive parameters to `MarketPool` to protect LPs from adverse selection and end-of-life arbitrage.

### 1.1 On-chain configuration script

Use `scripts/set-lp-guard.ps1` to update defensive parameters for Trading-state pools anytime (only Pool authority/creator may call).

```powershell
.\scripts\set-lp-guard.ps1 -PoolId 0xYourPoolId `
  -FeeMultiplierBps 5000 `
  -SigmaVirtualTenths 2 `
  -ConcentrationVirtual 10 `
  -DepositCutoffBps 1000 `
  -ResolutionWindowTs 3600
```

**Parameter meanings:**

- `FeeMultiplierBps`: dynamic fee multiplier. E.g. base fee 30 bps, set to 5000 (50%) → effective fee = `30 * (1 + 50%) = 45 bps`.
- `SigmaVirtualTenths`: (Normal pool) virtual volatility. E.g. 2 means pricing uses σ 0.2 higher than actual, flattening quotes.
- `ConcentrationVirtual`: (Dirichlet pool) virtual concentration. E.g. 10 adds 10 to each outcome α, pulling probabilities toward the mean.
- `DepositCutoffBps`: T2 deposit cutoff window. 1000 (10%) means `deposit_liquidity` is blocked in the last 10% of time before maturity.
- `ResolutionWindowTs`: settlement timelock. 3600 (seconds) blocks all `buy_*` in the last hour before maturity.

### 1.2 Frontend observation

On `/markets/[id]`, an **IV / LP Guard panel** shows live base fee, effective fee, virtual σ, etc. Enter Pool ID to observe.

### 1.3 Automatic dynamic fees (LP Guard Keeper)

On-chain `set_lp_guard_params` is ready; **automatic one-sided dump detection and fee hikes** are handled off-chain by the Keeper:

```bash
cd services/lp-guard-keeper
cp .env.example .env.local
# Set LP_GUARD_POOL_IDS, LP_GUARD_KEEPER_SECRET_KEY (must be pool authority)
npm install
npm test
npm run dev    # LP_GUARD_DRY_RUN=true observes only by default
```

**Signal summary:**

| Signal | Weight | Meaning |
| --- | --- | --- |
| Parameter drift | 40% | μ / λ / α change magnitude in window |
| One-sided skew | 35% | consecutive same-direction parameter updates or Dirichlet concentration |
| Volume shock | 25% | `collateral_usdc` delta vs EMA |

Risk up → `fee_multiplier_bps` rises (e.g. base 200 bps → effective 800 bps); risk down → multiplier decays × `0.85` each tick. See [services/lp-guard-keeper/README.md](../services/lp-guard-keeper/README.md).

---

## 2. LP redemption (Withdraw Liquidity)

Phase 1.5 added NAV subscription; Phase 2 adds NAV redemption.

### 2.1 Frontend

1. Go to `/lp` (LP shares page)
2. Lists all your `LpShare` objects
3. On each card, enter the market's `Pool ID`
4. Click **Redeem LP**
5. On-chain: burns `LpShare`, computes USDC at current NAV, transfers to wallet

### 2.2 Script

```powershell
.\scripts\withdraw-liquidity.ps1 -PoolId 0xYourPoolId -LpShareObjectId 0xYourLpShareId
```

---

## 3. Advanced derivative trading

Phase 2 adds linear and straddle options on Normal markets (e.g. CPI, BTC price).

### 3.1 Frontend

1. Go to `/markets/normal-cpi` (or your Normal market)
2. In **Trade panel** contract type dropdown:
   - **Linear Call**: payoff $\max(X - K, 0)$
   - **Linear Put**: payoff $\max(K - X, 0)$
   - **Straddle**: payoff $|X - K|$
3. Enter **Strike K (tenths)** (e.g. 25)
4. Enter Stake (USDC), click **Buy with USDC**

*Note: buying linear products creates the position and dynamically pushes pool σ (volatility), reflecting tail-risk expectations.*

---

## 4. Cross-Margin

Phase 2 adds on-chain `MarginAccount` ledger: bind multiple Positions in one market and compute max liability jointly.

### 4.1 Frontend

1. Go to `/margin`
2. **New account**: enter `Pool ID`, click create — wallet receives `MarginAccount`
3. **Register position**: enter `Pool ID`, `MarginAccount ID`, and `Position ID`, click register
   - On-chain computes P&L per slot and accumulates on `MarginAccount`
4. **Portfolio VaR**:
   - `/margin` shows `MarginAccount` with **Gross Stake** and **Worst Liability**
   - `/positions` aggregates **Cross-Margin VaR** across positions

### 4.2 Rationale

Cross-Margin reduces worst-case liability when hedged (Call + Put or different intervals), vs summing independent liabilities — foundation for Phase 3 leverage.

---

## 5. Current scope (Phase 2 vs Phase 3)

Phase 2 implements:

- LP Guard (dynamic fees, virtual liquidity, time windows)
- NAV redemption and `T2` end-of-life deposit cutoff
- Linear options / Straddle
- Cross-Margin ledger and frontend VaR

Phase 3 core extensions are live:

- Tier-2 ZK coprocessor: `submit_proof` / `verify_proof`
- Slash: `slash_pool` / `unslash_resume_pool`
- Structured note basket: Variance / Structured / Range / Barrier

See: [Phase 3 Playbook](./phase3-playbook.md).
