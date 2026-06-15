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

# LP Guard Keeper

**English** | [简体中文](./README.zh.md)

Off-chain dynamic fee engine: monitors `MarketPool` parameters (`μ` / `λ` / `α`) for one-sided drift, skew, and volume shock over short windows, then automatically calls `pool::set_lp_guard_params` to raise `fee_multiplier_bps`, virtual `σ`, and concentration; when risk subsides, values decay smoothly back down.

## Architecture

```
RPC poll pool state
  → Risk score (drift 40% + skew 35% + volume 25%)
  → Compute target fee_multiplier / sigma_virtual / concentration_virtual
  → authority signs set_lp_guard_params (non-critical path, does not block trades)
```

**Requirement:** The keeper key address must be `MarketPool.authority` for each pool.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Description |
| --- | --- |
| `LP_GUARD_POOL_IDS` | Comma-separated Trading pool IDs |
| `LP_GUARD_KEEPER_SECRET_KEY` | Pool authority private key |
| `X_MARKET_PACKAGE_ID` | Published package ID |
| `LP_GUARD_MAX_EFFECTIVE_FEE_BPS` | Effective fee cap (default 800 = 8%) |
| `LP_GUARD_DRY_RUN` | When `true`, log only; no transactions |

**2% → 8% example:** Base pool fee `fee_bps = 200`; at max risk score the keeper sets `fee_multiplier_bps` to `30000`, so on-chain `effective_fee_bps = 800`.

## Run

```bash
cd services/lp-guard-keeper
npm install
npm test
npm run dev          # development (watch)
LP_GUARD_DRY_RUN=false npm start   # production on-chain updates
```

## Health Check

```
GET http://localhost:8788/health
```

Returns `keeper`, `pools`, `dryRun`, `gasBalanceMist`. In production mode (`LP_GUARD_PRODUCTION=true`), startup fails if balance is low or `DRY_RUN=true`.

## Docker

See repository root `docker-compose.services.yml`.

## On-Chain Module Relationship

- Fee calculation: `sources/lp_guard.move` (`effective_fee_bps`)
- Writes: `pool::set_lp_guard_params` (authority only)
- Observability: frontend `IvPanel.tsx`
