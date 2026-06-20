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

**English** | [简体中文](./phase1.5-playbook.zh.md)

# X-Market Sui Phase 1.5 Playbook

This guide walks through Phase 1.5 end-to-end on **Sui Testnet**:

- Opening Auction (Poisson + Dirichlet + Normal)
- Auction → Trading state transition
- NAV subscription `deposit_liquidity`
- LP share object `LpShare`

---

## 1. Prerequisites

### 1.1 Tools and environment

- Sui CLI installed and `sui client active-address` works
- Active address has enough SUI for gas
- Repository cloned locally: `g:\apps\x-market-sui`

### 1.2 Key facts (very important)

Phase 1.5 adds on-chain modules/entry points (e.g. `start_dirichlet_auction`, `lp_token`, `nav`), therefore:

- **You must publish a new package containing Phase 1.5 code** (or confirm the existing package is upgraded to this version)
- If you keep using an old package ID, calling new entry points will fail with `Function not found`

---

## 2. On-chain publish and verification

From the repository root:

```powershell
sui move test
sui move build
sui client publish --gas-budget 500000000
```

Record from the publish result:

- `Package ID`
- `UpgradeCap`
- `TreasuryCap<USDC>` (if Faucet minting is needed)

Recommended: write the new package ID to an environment variable (for script reuse):

```powershell
$env:X_MARKET_PACKAGE_ID="0xYourNewPackageId"
```

---

## 3. Start Auction pools

### 3.0 Frontend (recommended)

Open `/markets/create`:

1. Set **Launch mode** to **Opening Auction**
2. Fill title, distribution kind, auction end, maturity, Oracle Feed
3. Indexer stores `launch_mode=auction`, `status=0`; home list shows an **In auction** badge

Requires a package with `start_*_auction_with_feed` and `NEXT_PUBLIC_PACKAGE_ID`.

### 3.1 CLI script (bare pool / demos)

Script: `scripts/start-auction-pool.ps1`

```powershell
.\scripts\start-auction-pool.ps1 -Kind poisson -PackageId 0xYourNewPackageId -AuctionHours 24 -MaturityDays 30
```

With Oracle Feed (new package + env vars):

```powershell
.\scripts\start-auction-pool.ps1 -Kind dirichlet -WithFeed -FeedIdentifier "MY_AUCTION" -AuctionHours 24
```

### 3.2 Create a Poisson Auction pool

```powershell
.\scripts\start-auction-pool.ps1 -Kind poisson -PackageId 0xYourNewPackageId -AuctionHours 24 -MaturityDays 30
```

### 3.3 Create a Dirichlet Auction pool

```powershell
.\scripts\start-auction-pool.ps1 -Kind dirichlet -PackageId 0xYourNewPackageId -AuctionHours 24 -MaturityDays 30
```

### 3.4 Create a Normal Auction pool (macro, e.g. CPI)

Three-bucket anchors: μ = 2.0% / 2.5% / 3.0% (tenths 20/25/30), σ = 0.3% / 0.4% / 0.6% (tenths 3/4/6), calibrated by USDC-weighted buckets.

```powershell
.\scripts\start-auction-pool.ps1 -Kind normal -PackageId 0xYourNewPackageId -AuctionHours 24 -MaturityDays 30
```

The output includes a new `MarketPool` object ID — save it for frontend bidding.

> Default `Clock` is `0x6`; override with `-ClockId` if needed.

---

## 4. Mint test USDC

If you have `TreasuryCap`, run directly:

```powershell
.\scripts\mint-test-usdc.ps1
```

Or click **Mint test USDC** on the frontend market page (via the Faucet package).

---

## 5. Frontend configuration and startup

In the `app` directory, configure `.env.local` (copy from `.env.example`):

```env
NEXT_PUBLIC_PACKAGE_ID=0xYourNewPackageId
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_CLOCK=0x6

# Old pools can be filled first; new Auction pools can be entered manually on the page
NEXT_PUBLIC_POOL_POISSON=0x...
NEXT_PUBLIC_POOL_DIRICHLET=0x...
NEXT_PUBLIC_POOL_NORMAL=0x...
```

Start the frontend:

```powershell
cd app
npm install
npm run dev
```

---

## 6. Recommended hands-on flow

Open a market page `/markets/[id]`. The page now has three panels:

- `TradePanel` (trading)
- `LpDepositPanel` (LP subscription)
- `AuctionPanel` (bidding + finalize)

### 6.1 Opening Auction bidding

1. In `AuctionPanel`, enter the Auction Pool ID you just created
2. Select a bucket (0/1/2)
3. Enter bid USDC and click `auction_bid`
4. Repeat to simulate multiple participants

### 6.2 Finalize after Auction ends

After `auction_end_ts`, click `finalize_auction`:

- Poisson: derive `lambda_tenths` from bucket proportions
- Dirichlet: generate initial `alpha` from bucket proportions
- State transitions from `Auction` to `Trading`

Funds accumulated in the Vault during Auction also seed initial LP (`lp_shares` seed).

### 6.3 LP subscription during Trading (NAV)

In `LpDepositPanel`:

1. Enter a Pool ID in Trading state
2. Enter USDC to deposit
3. Click `deposit_liquidity`

On-chain behavior:

- LP shares minted from `nav_pre` (not fixed 1:1)
- Dirichlet pools scale α proportionally (preserving probability shape)
- Mints `LpShare` object to wallet

### 6.4 View LP shares

Go to `/lp`:

- See `LpShare` objects
- Display shares and object IDs

---

## 7. Troubleshooting

### 7.1 `Function not found`

Cause: still calling an old package ID.
Fix: confirm `NEXT_PUBLIC_PACKAGE_ID`, script `-PackageId`, and wallet interaction target all point to the newly published package.

### 7.2 `not_auction` / `auction_not_ended`

- `not_auction`: pool is not in Auction state (may already be finalized)
- `auction_not_ended`: deadline not reached yet

### 7.3 Insufficient USDC or payment failure

- Mint/transfer USDC first
- Frontend auto-merges multiple USDC coins before payment

### 7.4 Insufficient gas

Prepare more SUI; merge SUI coins if needed.

---

## 8. Current scope (Phase 1.5 vs Phase 2 / Phase 3)

Phase 1.5 implements:

- Opening Auction (Poisson + Dirichlet)
- NAV subscription and `LpShare`

Advanced features (Phase 2) are now fully implemented:

- `withdraw_liquidity` (LP redemption)
- `T2` deposit cutoff before maturity
- Dynamic fees / virtual liquidity / settlement timelock
- Linear options / Straddle / Cross-Margin

Extended capabilities (Phase 3) now include core protocol forms:

- Tier-2 ZK coprocessor interface (`zk_coprocessor`)
- Slash risk controls (`slash`)
- Advanced volatility and note baskets: Variance Swap / Structured Note / Range Note / Barrier Note

See also:

- [Phase 2 Playbook](./phase2-playbook.md)
- [Phase 3 Playbook](./phase3-playbook.md)
