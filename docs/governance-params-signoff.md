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

# Governance Parameters Sign-Off Record (P0.6)

**English** | [简体中文](./governance-params-signoff.zh.md)

> **Baseline file:** [governance-params-baseline.json](./governance-params-baseline.json)  
> **Human-readable table:** [mainnet-governance-params.md](./mainnet-governance-params.md)  
> **Automated verification:** `.\scripts\verify-governance-params.ps1`

---

## 0. Metadata

| Item | Value |
|------|-------|
| Baseline version | `1.0.0` |
| Lock date | 2026-06-06 |
| Git commit | `e3e3ec16b9ea96255915c9baab15b0dc81dbc4a9` (update after upgrade) |
| Package ID (Testnet v3) | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| Verify command | `.\scripts\verify-governance-params.ps1` |
| Verify result | **16/16 passed** (2026-06-06) |

---

## 1. Mainnet Confirmed Values Summary (Locked)

### LP Guard

| Parameter | Mainnet confirmed value |
|-----------|-------------------------|
| Seed pool base fee | **200 bps** |
| Keeper effective fee cap | **800 bps** |
| Keeper fee multiplier cap | **30000** |
| Virtual σ / concentration cap | **20 / 50** |
| Deposit cutoff | **1000 bps** (10% before expiry) |
| Resolution time lock | **86400 s** (24h) |
| Keeper poll / decay | **30s / 0.85** |

> Testnet seed pools currently use `fee_bps=30`, `deposit_cutoff=0` for integration only — **not** mainnet defaults.

### Slash

| Parameter | Mainnet confirmed value |
|-----------|-------------------------|
| Timelock | **1800 s** |
| Single-event cap | **30%** |
| Period cumulative cap | **50%** |
| Multisig `SlashGovernance` | **Enabled** (created at mainnet init) |

### ZK / Oracle / Prophet

| Module | Mainnet confirmed value |
|--------|-------------------------|
| ZK challenge window | **3600 s**; finalize owner: **protocol ops on-call** |
| Oracle min bond | **10 USDC**; dispute window **86400 s** |
| Prophet protocol fee | **5%**; paid unlock gate **3 audited + Score ≥ 40** |
| Gas Station | **Removed** — no sign-off needed |

---

## 2. Dual-Review Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Protocol lead | | | |
| Risk lead (review) | | | |
| Ops lead | | | |
| Product lead | | | |

---

## 3. Confirmation Checklist

- [x] `governance-params-baseline.json` filled
- [x] `mainnet-governance-params.md` mainnet values filled
- [x] `verify-governance-params.ps1` passed (16/16, 2026-06-06)
- [ ] Consistent with `mainnet-readiness-checklist.md` §3
- [ ] Dual-review sign-off complete
- [ ] Signed scans archived (not in git)

---

## 4. Change Process

If any parameter changes before mainnet launch:

1. Update `governance-params-baseline.json` and bump `version`
2. Sync `mainnet-governance-params.md`
3. Re-run `verify-governance-params.ps1`
4. Archive new sign-off record
