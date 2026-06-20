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

**English** | [简体中文](./demo-walkthrough.zh.md)

# X-Market Sui Core Business Demo Guide

> **Version:** v1.0 · **Date:** 2026-06-08  
> **Purpose:** Product demos, investor pitches, internal onboarding  
> **Related:** [test-cases.md](./test-cases.md) · [PRD.md](../PRD.md) · [deploy/testnet-v2.json](../deploy/testnet-v2.json)

---

## 1. The Story the Demo Should Tell

Use **one thread** to connect the product—avoid stacking modules:

```
Real-world events (goals / CPI / win-draw-loss)
        │
        ▼
   EventRoot + Oracle Feed (single source of truth)
        │
   ┌────┴────┐
   ▼         ▼
X-Market    SuiProphet
On-chain AMM    Private predictions + paid unlock
Buy Position    Post-hoc audit of track record
   │         │
   └────┬────┘
        ▼
   Oracle settlement → claim / audit
```

**Three-sentence version:**

1. **One event root** — Betting and knowledge monetization share the same Oracle outcome; data is not siloed.  
2. **Tier 1 on-chain pricing** — Millisecond PDF integration with no external quote dependency (see [tier2-decision.md](./tier2-decision.md)).  
3. **Optimistic Oracle + economic constraints** — Propose → dispute → committee; risk controls include Slash / LP Guard (cold path).

---

## 2. Which Demo Route to Choose

| Route | Duration | Best for | Can claim on the spot? |
| --- | --- | --- | --- |
| **Route A · Lightning demo** | 15–20 min | Pitches, first meetings | No (explain verbally) |
| **Route B · Standard demo** | 35–45 min | Customer POC, team training | No (show Oracle flow) |
| **Route C · Full loop** | 1–2 days | Deep diligence, screen recording | Yes (requires pre-built demo pool) |

> **Why can seed pools usually not be claimed on the spot?**  
> Seed pools in [deploy/testnet-v2.json](../deploy/testnet-v2.json) have `maturityTs` in the future, and the Oracle dispute window is 24h.  
> Route C explains how to create a **short-maturity demo pool** in advance.

---

## 3. Pre-Demo Checklist

### 3.1 Environment (30 minutes before demo)

```powershell
# Repository root
cd g:\apps\x-market-sui\app
cp .env.example .env.local   # If not yet configured
npm install
npm run dev                  # http://localhost:3000
```

Confirm `.env.local` matches [deploy/testnet-v2.json](../deploy/testnet-v2.json) (Package, three pool IDs, Oracle, Prophet Registry).

### 3.2 Wallet

| Item | Requirement |
| --- | --- |
| Network | Sui **Testnet** |
| SUI | ≥ 0.5 SUI (Gas) |
| USDC | ≥ 100 test USDC (demo buys + Prophet unlock) |

**Get test tokens:**

```powershell
# When TreasuryCap is available
.\scripts\mint-test-usdc.ps1

# Or use "Mint test USDC" on the frontend market page (Faucet package)
# Or ask deployer: .\scripts\transfer-test-usdc.ps1 -Recipient 0x你的地址
```

### 3.3 Prophet demo (wallet gas)

If demoing `/prophet`, ensure the demo wallet has enough **Testnet SUI** (Commit / Unlock / Audit are wallet-paid):

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1   # LP Guard :8788 should return 200
```

### 3.4 Demo materials (recommended to prepare in advance)

| Material | Purpose |
| --- | --- |
| 1–2 purchased Positions | Open `/positions` without waiting for on-chain confirmation |
| 1 Suivision transaction link | Explain "on-chain atomic pricing" |
| (Route C) Demo-specific Pool ID | Write on a sticky note, enter manually on page |

### 3.5 Dual wallets (when demoing Prophet paid unlock)

| Wallet | Role |
| --- | --- |
| Wallet A | Prophet Commit |
| Wallet B | Subscriber Unlock + decrypt |

Use two browsers (Chrome + Edge) or Sui Wallet multi-account.

---

## 4. Route A · Lightning Demo (15–20 minutes)

> **Goal:** Show the audience "you can buy, there are on-chain positions, the product shape is complete"—without waiting for the Oracle window.

### Step overview

| Step | Page | Action | Talking points |
| --- | --- | --- | --- |
| A1 | `/` | Show three seed market cards | Three distributions: Poisson / Dirichlet / Normal |
| A2 | `/markets/poisson-goals` | Connect wallet → mint USDC (if needed) | Vault-custodied USDC, not Uniswap token pairs |
| A3 | Same · trade panel | Select "digital option" k=3 or "range" [2,3] → buy 10 USDC | **Tier 1**: same tx updates λ + mints Position |
| A4 | `/positions` | Refresh, open the Position just bought | Owned Object, transferable |
| A5 | `/markets/normal-cpi` | Show IV / LP Guard panel (enter Pool ID if not auto-filled) | LP defense: dynamic fees, virtual σ |
| A6 | `/oracle` | Select Poisson market → watch Feed auto-discovery | L0 and L2 decoupled; Feed not hardcoded in .env |
| A7 | (Verbal) | — | Settlement requires maturity + Oracle finalize; production has no Admin unilateral button |

### Recommended script (A3 buy)

> "Traditional AMMs swap token pairs; here it's a **parametric AMM**—users buy payout commitments with USDC, and the on-chain Poisson distribution's λ updates with this order."

### Fallback: if buy fails

| Symptom | Action |
| --- | --- |
| Insufficient USDC | Mint or merge USDC |
| Insufficient Gas | Get SUI from Testnet faucet |
| `paused` | Switch seed pool or check if paused by Slash drill |
| Function not found | Check whether `NEXT_PUBLIC_PACKAGE_ID` is the v3 package |

---

## 5. Route B · Standard Demo (35–45 minutes)

Build on Route A, adding **Opening Auction, LP, Prophet, Oracle propose**.

### 5.1 Opening Auction (~8 minutes)

**Method 1: Frontend (recommended)**

1. Open `/markets/dirichlet-wdl`
2. Scroll to **AuctionPanel**
3. Enter a **new** Auction Pool ID (see script below) or an ID created by a colleague in advance
4. Select bucket 0/1/2, bid 20 USDC → bid on another bucket (can switch wallets to simulate multiple bidders)
5. After bidding ends, click **finalize_auction** → status becomes Trading

**Method 2: Create short auction pool before demo**

```powershell
$env:X_MARKET_PACKAGE_ID="0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"

# Auction 0 hours = can finalize immediately after creation; maturity 30 days
.\scripts\start-auction-pool.ps1 -Kind dirichlet -AuctionHours 0 -MaturityDays 30
# Record the output MarketPool Object ID
```

**Talking points:**

> "LP is not swapping token pairs—it's **underwriting prior probabilities**—bucket bid ratios set Dirichlet initial α; AMM opens only after finalize."

### 5.2 LP subscription (~5 minutes)

1. `/markets/dirichlet-wdl` → **LpDepositPanel**
2. Enter a Pool ID in **Trading** state
3. Deposit 50 USDC → `deposit_liquidity`
4. Open `/lp` → see `LpShare` object

**Talking points:** NAV subscription, Dirichlet α scaled proportionally (probability shape unchanged).

### 5.3 Second trade + structured products (~5 minutes)

1. `/markets/normal-cpi` → contract type **Variance Swap** or **Range Note**
2. Small buy → `/positions` to see new tag

Note: Phase 3 notes are still **Normal + Tier 1**, no ZK hot path dependency.

### 5.4 SuiProphet knowledge monetization (~10 minutes)

1. Open `/prophet`
2. **Wallet A**: Select Normal CPI pool → enter prediction + short analysis → **Commit**  
   (Seal encrypt → Indexer blob → on-chain `commit_private_prophecy`)
3. **Wallet B**: Same prophecy → **Unlock** (pay USDC) → page auto-attempts decrypt
4. Open `/leaderboard` → explain audit requires Oracle settlement first

**Talking points:**

> "Signal sharing and betting share the **same Pool, same lock_time**; after Oracle settlement `audit_prophecy` verifies plaintext with blake2b256—editing the draft is CHEAT."

See [prophet-playbook.md](./prophet-playbook.md) for detailed on-chain semantics.

### 5.5 Oracle propose (~5 minutes)

1. `/oracle` → select **Poisson goals** market
2. Confirm page has **auto-discovered Feed** (no manual Feed ID needed)
3. Fill `claimed_value` (Poisson: outcome slot 0–14, e.g. 3 goals → enter `3`)
4. Click **Propose result** → stake USDC
5. Show **dispute window countdown** (Testnet usually 24h)

**Talking points:** Optimistic game four phases—propose → window → [dispute/committee] → consume.  
**Be honest:** Cannot finalize on the spot; production triggered by Proposer or ops after window.

### 5.6 Risk control cold path (~3 minutes, optional PPT / docs)

Open [slash-and-attestation.md](./slash-and-attestation.md) diagram, walk through verbally:

- **Attestation**: ZK supervision registers `proof_hash`, does not block `buy_*`
- **Slash**: After dispute upheld, forfeit Vault, pause market, 1800s timelock resume

No need to execute `slash_pool` on site (will pause seed pool).

---

## 6. Route C · Full Loop (1–2 days)

> **Goal:** Screen recording or diligence showing **buy → settle → claim**, plus Prophet **audit**.

### 6.1 Day before demo (T-1)

```powershell
$env:X_MARKET_PACKAGE_ID="0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"

# 1. Create short-maturity Poisson demo pool (auction can finalize immediately)
.\scripts\start-auction-pool.ps1 -Kind poisson -AuctionHours 0 -MaturityDays 1

# 2. Record POOL_ID, finalize via frontend AuctionPanel

# 3. Register Feed for this pool (if not via _with_feed)
#    See init-oracle-testnet.ps1 or /oracle page "Register Feed"

# 4. Buy range [2,4] digital or range contract, keep 20 USDC
# 5. (Optional) Wallet A Commit on /prophet for this POOL_ID
```

Note `POOL_ID`, expected `resolved_value` (e.g. 3 goals), and buy range in demo notes.

### 6.2 Demo day T — settlement and claim

**Prerequisite:** On-chain time ≥ `maturity_ts`.

#### Path C1 · Production path (Oracle optimistic flow)

| Order | Action | Page/entry |
| --- | --- | --- |
| 1 | `propose_data` | `/oracle` |
| 2 | Wait dispute window (24h) | — |
| 3 | `finalize_assertion` | `/oracle` |
| 4 | Pool `resolved` | Page status becomes "Settled" |
| 5 | `claim_position` | `/positions` |

Suited for **T-1 propose, T-day finalize** cross-day screen recording.

#### Path C2 · Testnet fast path (integration only, not for production narrative)

> Requires **AdminCap**; maturity must have passed.

```powershell
$PKG = "0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"
$GLOBAL = "0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08"
$ADMIN = "0xb18fdb5f7ceaf2ccc9f94f35594043de3773422520666ec391e54e6b02b5b8c2"
$POOL = "0x你的演示池ID"
$CLOCK = "0x6"
# resolved_value: Poisson outcome slot, e.g. 3 means total goals 3
$VALUE = 3

sui client call --package $PKG --module settlement_oracle --function report_resolution `
  --args $GLOBAL $ADMIN $POOL $VALUE $CLOCK --gas-budget 100000000
```

Then click **Claim payout** on `/positions`.

**Tell the audience:** "This is the Testnet integration fast path; mainnet only uses Oracle committee final ruling—no Admin unilateral settlement."

### 6.3 Prophet audit (Route C supplement)

After Oracle settlement and `lock_time` reached:

1. `/prophet` → **Audit** step
2. Prophet submits plaintext consistent with Commit
3. On-chain hash comparison → WIN/LOSS/CHEAT → `/leaderboard` updates

---

## 7. Page Quick Reference (demo flow)

```
/  Home · seed market entry
├── /markets/poisson-goals    Football Poisson · range/digital
├── /markets/dirichlet-wdl    Win-draw-loss · Auction + LP panel
├── /markets/normal-cpi       CPI Normal · structured notes + IV panel
├── /positions                Positions · claim
├── /lp                       LP shares · redeem
├── /oracle                   Feed · propose · dispute · Finalize
├── /prophet                  Commit · Unlock · Audit
├── /leaderboard              Prophet track record
└── /margin                   Cross-Margin (optional brief mention)
```

---

## 8. Demo On-Chain IDs (Testnet v3)

From [deploy/testnet-v2.json](../deploy/testnet-v2.json)—verify `.env.local` before demo:

| Resource | ID |
| --- | --- |
| Package | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| Poisson pool | `0xb5d1a85213d6757d1cb386e8b719b524162a117018e6f5b8f0101f4dcc532b5f` |
| Dirichlet pool | `0x89fb5ff5754fe5b2d32d071ce98ad778b62a48f738e0d7dd27a86b390eddaac5` |
| Normal pool | `0xa43716a746c01d6039cd7b9e6a77562f17a8730dc72c9363ddfde06859e4f834` |
| OracleConfig | `0x1ad185d06bcbb53a98c5a834516da7a28c748f32079faa8ff310a35d04f663d8` |
| ProphetRegistry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |
| Faucet package | `0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0` |

Browser package page:  
https://testnet.suivision.xyz/package/0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e

---

## 9. FAQ (live demo)

| Question | Answer / action |
| --- | --- |
| How is this different from Polymarket? | Parametric AMM + on-chain PDF; multiple distribution templates; LP underwrites probability not token swaps |
| Why not Tier 2 / on-chain ZK? | [tier2-decision.md](./tier2-decision.md): main path Tier 1 covers MVP; ZK is async supervision |
| Who decides Oracle? | Optimistic propose + dispute + **committee** multisig, not Admin unilateral |
| Can we claim on the spot? | Seed pools generally no; Route C or pre-recorded video |
| Prophet decrypt fails | Check package ID matches encryption time; Unlock succeeded; SessionKey not expired |
| Indexer blob upload fails | Confirm Indexer running; `NEXT_PUBLIC_INDEXER_URL` correct |
| Blank page / RPC timeout | Configure `NEXT_PUBLIC_SUI_RPC_URL` backup RPC |

---

## 10. Post-Demo Wrap-Up

- [ ] Stop `npm run dev` and `stop-services-testnet.ps1` (if started)
- [ ] Record Pool ID and tx digest used (for reproduction)
- [ ] If seed pool accidentally Slashed: Admin `unslash_resume_pool` after 1800s timelock
- [ ] Log feedback in [test-cases.md](./test-cases.md) or drill record

---

## 11. Related Docs

| Doc | When to consult |
| --- | --- |
| [test-cases.md](./test-cases.md) | QA regression, convert demo items to tests |
| [phase1.5-playbook.md](./phase1.5-playbook.md) | Auction / LP on-chain details |
| [oracle-playbook.md](./oracle-playbook.md) | Oracle dispute and committee ops |
| [prophet-playbook.md](./prophet-playbook.md) | Seal / Indexer blob troubleshooting |
| [phase3-playbook.md](./phase3-playbook.md) | Slash / ZK if doing risk control demo |

---

## Revision History

| Date | Version | Notes |
| --- | --- | --- |
| 2026-06-08 | v1.0 | Initial: Routes A/B/C, checklist, page flow, Testnet IDs |
