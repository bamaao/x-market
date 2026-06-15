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

**English** | [简体中文](./mainnet-governance-params.zh.md)

# X-Market Sui Mainnet Governance Parameter Baseline (Sign-off Edition)

> **Purpose:** One-time confirmation before P0.6 launch; dual review and sign-off on this table.  
> **Machine-readable baseline:** [governance-params-baseline.json](./governance-params-baseline.json)  
> **Sign-off record:** [governance-params-signoff.md](./governance-params-signoff.md)  
> **Automated verification:** `.\scripts\verify-governance-params.ps1`

---

## 1. LP Guard (`lp_guard.move` / `pool::set_lp_guard_params`)

| Parameter | Testnet measured | Mainnet confirmed value | On-chain / off-chain field |
|------|--------------|------------|---------------|
| Base fee rate | 30 bps (integration) | **200 bps** | `fee_bps` (at pool creation) |
| Fee multiplier cap | 30000 | **30000** | `LP_GUARD_MAX_FEE_MULTIPLIER_BPS` |
| Effective fee cap | 800 bps | **800 bps** | Keeper computed cap |
| Virtual σ cap | 20 | **20** | `sigma_virtual_tenths` |
| Virtual concentration cap | 50 | **50** | `concentration_virtual` |
| Deposit cutoff | 0 (unset) | **1000 bps** | `deposit_cutoff_bps` |
| Settlement timelock | 0 (unset) | **86400 s** | `resolution_window_ts` |
| Keeper poll interval | 30s | **30s** | `LP_GUARD_POLL_MS` |
| Decay factor | 0.85 | **0.85** | `LP_GUARD_DECAY_FACTOR` |
| Update threshold | 200 bps | **200 bps** | `LP_GUARD_UPDATE_THRESHOLD_BPS` |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 2. Slash Governance (`slash.move`)

| Parameter | On-chain constant | Mainnet confirmed value |
|------|----------|------------|
| Timelock | 1800 s | **1800 s** |
| Single deduction cap | 3000 bps (30%) | **30%** |
| Period cumulative cap | 5000 bps (50%) | **50%** |
| Proposal TTL | 86400 s | **86400 s** |
| Multisig `SlashGovernance` | Optional | **Enabled** |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 3. ZK Coprocessor (`zk_coprocessor.move`)

| Parameter | On-chain constant | Mainnet confirmed value |
|------|----------|------------|
| Challenge window | 3600 s | **3600 s** |
| Finalize policy | Trigger after window ends | Protocol ops on-call responsible for `finalize_verification` |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 4. Macro Data Oracle (`macro_oracle.move`)

| Parameter | Testnet on-chain | Mainnet confirmed value |
|------|--------------|------------|
| Minimum bond | 10_000_000 (10 USDC) | **10 USDC** |
| Dispute window | 86400 s | **86400 s (24h)** |
| Final arbitration | `oracle_arbitrator` multisig | **Mainnet: built-in committee**; P2 evaluate UMA DVM |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 5. SuiProphet (`prophet_registry` / `prophet_leaderboard`)

| Parameter | On-chain constant | Mainnet confirmed value |
|------|----------|------------|
| Protocol fee | 500 bps (5%) | **5%** |
| Minimum audits for paid unlock | 3 | **3** |
| Minimum Score for paid unlock | 4000 bps | **40/100** |
| Close paid unlock before deadline | 300 s | **lock_time − 5 min** |
| Cheat cap (paid) | 0 | **0** |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 6. Gas Station (off-chain)

| Parameter | Testnet pre-release | Mainnet confirmed value |
|------|--------------|------------|
| Sponsorship rate limit / address / minute | 30 | **30** |
| Gas balance alert | 500_000_000 mist | **0.5 SUI** |
| Production package ID validation | Enabled | **Required** |
| CORS | `http://localhost:3000` | **Production frontend domain** (fill in for mainnet) |

**Sign-off:** _______________ Date:________  
**Review:** _______________ Date:________

---

## 7. Confirmation Checklist

- [x] "Mainnet confirmed value" column filled in above
- [x] `governance-params-baseline.json` generated
- [x] `verify-governance-params.ps1` passed (16/16)
- [ ] Consistent with `mainnet-readiness-checklist.md` §3
- [ ] Dual review sign-off (see [governance-params-signoff.md](./governance-params-signoff.md))
- [ ] Scanned copies archived to internal storage (not git)
