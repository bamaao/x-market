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

# X-Market Sui Mainnet Readiness Checklist

**English** | [简体中文](./mainnet-readiness-checklist.zh.md)

This checklist turns current implementation status into executable launch steps, assuming **mainnet release after Phase 3 completion**.

> **Infrastructure priority (P0–P3):** [mainnet-infra-priority.md](./mainnet-infra-priority.md)  
> **Governance params sign-off:** [mainnet-governance-params.md](./mainnet-governance-params.md) · [governance-params-signoff.md](./governance-params-signoff.md)  
> **Param verification:** `.\scripts\verify-governance-params.ps1`  
> **P0 automated checks:** `.\scripts\verify-p0-readiness.ps1`

---

## 1. Release Freeze and Version Tag

- [ ] Freeze release window (no non-mainnet-blocking changes)
- [ ] Lock target commit hash (record `git rev-parse HEAD`)
- [ ] Generate candidate version (semantic, e.g. `v0.3.0-mainnet-rc1`)
- [ ] Publish change summary (protocol, risk, frontend, scripts, docs)

---

## 2. Contract and Access Control

- [ ] `sui move build` with no errors
- [ ] `sui move test` all pass
- [ ] Confirm `GlobalConfig` admin address (cold / multisig)
- [ ] Migrate `AdminCap` holder to governance address
- [ ] Replace and verify mainnet `USDC` coin type (disable test token paths)

---

## 3. Risk Parameter Baseline (One-Time Pre-Launch)

### 3.1 LP Guard Parameters

- [ ] Confirm `fee_multiplier_bps` baseline
- [ ] LP Guard Keeper deployed (`services/lp-guard-keeper/`, authority key custody)
- [ ] Confirm `sigma_virtual_tenths` baseline
- [ ] Confirm `concentration_virtual` baseline
- [ ] Confirm `deposit_cutoff_bps` baseline
- [ ] Confirm `resolution_window_ts` baseline

### 3.2 Slash Governance Parameters

- [ ] Timelock (current: `1800s`) meets governance requirements
- [ ] Single-event cap (current: `30%`) meets governance requirements
- [ ] Period cumulative cap (current: `50%`) meets governance requirements
- [ ] Multisig execution channel enabled (`SlashGovernance`)
- [ ] If enabled: `signers` and `threshold` list dual-reviewed

### 3.3 ZK Flow Parameters

- [ ] Challenge window (current: `3600s`) meets governance requirements
- [ ] Verification status codes documented externally (accepted/rejected/challenged)
- [ ] Ops defines `finalize_verification` trigger policy and owner

---

## 4. Governance and Emergency Drills (Must Leave Audit Trail)

- [ ] Drill A: Full buy → settle → claim flow
- [ ] Drill B: `slash_pool` → timelock expiry → recovery
- [ ] Drill C: Multisig `propose -> approve -> execute`
- [ ] Drill D: `ZkVerification` challenge + delayed finalization
- [ ] Archive tx hashes and screenshots for all drills
- [ ] Output drill report per template: `docs/mainnet-drill-record-template.md`

---

## 5. Frontend and Config Release

- [ ] Inject mainnet env:
  - `NEXT_PUBLIC_SUI_NETWORK=mainnet`
  - `NEXT_PUBLIC_PACKAGE_ID=<mainnet_package_id>`
  - `NEXT_PUBLIC_SUI_CLOCK=0x6`
- [ ] Verify frontend contract entry points match package ID
- [ ] Re-test `/positions` new ticket display and estimates
- [ ] Manual regression on key pages (markets, positions, LP)

---

## 6. Observability and Alerting

- [ ] Monitor `SlashRecord` events (count, amount, trigger)
- [ ] Monitor `ZkVerification` status changes and unfinalized backlog
- [ ] Monitor market `paused` status changes
- [ ] Monitor key tx failure rates (buy/claim/deposit/withdraw)
- [ ] Confirm on-call roster and escalation path

---

## 7. Launch Execution Runbook

1. [ ] Publish mainnet package and record `Package ID`
2. [ ] Init/migrate governance objects (e.g. `SlashGovernance`)
3. [ ] Create seed markets and inject initial liquidity
4. [ ] Switch frontend to mainnet config and canary release
5. [ ] Observe key metrics for 30–60 minutes
6. [ ] Public launch announcement (mainnet addresses + risk disclosure)

---

## 8. First 24 Hours Post-Launch

- [ ] Review fund and liability metrics every 2 hours
- [ ] Verify at least one full settlement closed loop
- [ ] Close all abnormal alert tickets
- [ ] Write `Day-1` postmortem (issues, fixes, param adjustments)

---

## 9. Done vs Pending (Latest Version)

### Completed

- `u64 -> u8` narrowing boundary checks end-to-end
- Cross-Margin global unique position registration lock
- ZK challenge period + delayed finalization
- Slash timelock + single/cumulative caps + multisig execution

### Pending

- External audit report closes all mainnet blockers
- Mainnet parameter sign-off (governance, risk, ops) archived
- Final mainnet release and Day-1 postmortem
