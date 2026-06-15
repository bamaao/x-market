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

**English** | [简体中文](./phase3-playbook.zh.md)

# X-Market Sui Phase 3 Playbook

This guide walks through Phase 3 capabilities on **Sui Testnet**:

- Tier-2 ZK coprocessor interface (`zk_coprocessor`)
- Slash risk controls (`slash`)
- Structured note basket (Variance / Structured / Range / Barrier)

---

## 1. Prerequisites

- Phase 1.5 and Phase 2 deployment complete
- Current `PACKAGE_ID` is a package containing Phase 3 code
- Wallet has USDC and enough SUI gas
- Admin address holds `AdminCap`

---

## 2. Publish and upgrade

From repository root:

```powershell
sui move build
sui client publish --gas-budget 500000000
```

Record:

- `Package ID`
- `GlobalConfig`
- `AdminCap`

Update frontend env:

```env
NEXT_PUBLIC_PACKAGE_ID=0xYourPhase3PackageId
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_CLOCK=0x6
```

---

## 3. Structured note trading (frontend)

On any Normal market (e.g. `/markets/normal-cpi`), **Contract type** in the trade panel:

1. **Variance Swap**
   - Param: `K`
   - Payoff: proportional to `(X-K)^2`, tail-volatility sensitive

2. **Structured Note (capped call)**
   - Params: `K`, `C`
   - Payoff: `min(max(X-K, 0), C-K)`
   - Constraint: `C > K`

3. **Range Note (range coupon)**
   - Params: `L`, `U`
   - Payoff: fixed coupon when `X ∈ [L,U]`
   - Constraint: `U >= L`

4. **Barrier Note (barrier coupon)**
   - Param: `B`
   - Payoff: fixed coupon when `X >= B`

---

## 4. ZK coprocessor interface (on-chain, Phase 3.1 enhanced)

Module: `x_market::zk_coprocessor`

> **Product decision:** Tier 2 joint PDF trading is not enabled before mainnet; module remains interface placeholder. See [tier2-decision.md](./tier2-decision.md).

> Current version is **Attestation + challenge-constraint transition layer**: on-chain does not run Groth16/Plonk math verification,
> but supports `proof_scheme_code`, verifier committee threshold attestation, challenge evidence hash, and challenge resolution.

### 4.1 Submit proof hash

- Entry: `submit_proof(pool, proof_hash, clock)`
- Result: wallet receives `ZkProofTicket` (owned object)

### 4.2 Admin verify proof (compat path)

- Entry: `verify_proof(config, cap, pool, ticket, status_code, clock)`
- `status_code`:
  - `1` = accepted
  - `2` = rejected
  - `3` = challenged
- Result: shared `ZkVerification` (`finalized=false`, default challenge window 3600 s)

### 4.2.1 Committee threshold verification (recommended)

- Init: `init_verifier_policy(config, cap, signers, threshold, ctx)`
- Update: `update_verifier_policy(config, cap, policy, signers, threshold, ctx)`
- First verify: `verify_proof_with_policy(policy, pool, ticket, status_code, proof_scheme_code, public_inputs_hash, clock, ctx)`
- Additional attestation: `attest_verification(policy, verification, ctx)`
- Notes:
  - `proof_scheme_code`: `1=Groth16, 2=Plonk, 3=STARK`
  - Finalize only when attestations reach `required_approvals`

### 4.3 Challenge during window

- Entry: `challenge_verification(pool, verification, evidence_hash, clock, ctx)`
- Only within challenge window; not after expiry
- Result:
  - `ZkVerification.status_code` → `3` (challenged)
  - Records `challenge_evidence_hash`
  - Finalize blocked until resolved

### 4.3.1 Admin challenge resolution

- Entry: `resolve_challenge(config, cap, verification, resolved_status_code, ctx)`
- `resolved_status_code` only `accepted` / `rejected`
- Closes challenge; allows subsequent finalize

### 4.4 Finalize after challenge window

- Entry: `finalize_verification(config, cap, verification, clock, ctx)`
- Admin only; requires:
  - Challenge window expired
  - Threshold attestations met
  - No unresolved challenge
- Result: `ZkVerification.finalized=true`

### 4.5 Brevis async Prover (off-chain, real integration)

> **Does not block trading hot path**; Keeper submits proof hash asynchronously after pool checkpoint changes. Brevis has no native Sui verifier; proof maps to on-chain `proof_hash` / `public_inputs_hash`.

**Service:** `services/brevis-zk-prover/`

```
Pool checkpoint change
  → off-chain audit (max-loss / parameter bounds)
  → mock: local SHA-256
  → live: Brevis RPC (BREVIS_RPC_URL) → fallback local on failure
  → submit_proof → verify_proof_with_policy
```

**Testnet init:**

```powershell
.\scripts\init-zk-verifier-policy.ps1 -PackageId 0x... -VerifierAddress 0x...
.\scripts\bootstrap-services-env.ps1
cd services/brevis-zk-prover && npm install && npm start
```

| Variable | Default | Description |
| --- | --- | --- |
| `ZK_PROVER_MODE` | `mock` | `live` tries Brevis RPC |
| `ZK_PROVER_DRY_RUN` | `true` | `false` to submit on-chain |
| `ZK_VERIFIER_POLICY_ID` | — | `init_verifier_policy` shared object |
| `BREVIS_RPC_URL` | empty | Brevis Prover HTTP endpoint |

Health: `GET http://localhost:8794/health`

---

## 5. Slash mechanism (on-chain)

Module: `x_market::slash`

### 5.1 Execute slash

- Entry: `slash_pool(config, cap, pool, amount_usdc, reason_code, recipient, clock)`
- Behavior:
  - Deduct `amount_usdc` from `MarketPool.vault`
  - Transfer to `recipient`
  - Set market `paused = true`
  - Governance recovery timelock (currently 1800 s)
  - Single slash cap: 30% of slash-period baseline collateral
  - Period cumulative cap: 50% of slash-period baseline collateral
  - Emits shared `SlashRecord`

### 5.1.1 Multisig execution path (optional)

- Init governance: `init_slash_governance(config, cap, signers, threshold, ctx)`
- Propose: `propose_slash_request(gov, pool, amount_usdc, reason_code, recipient, clock, ctx)`
- Approve: `approve_slash_request(gov, request, clock, ctx)`
- Execute at threshold: `execute_slash_request(gov, pool, request, clock, ctx)`
- Notes:
  - Each proposal has TTL (currently 86400 s)
  - Counts only valid approvals from current signer set
  - `slash_pool(...)` remains admin emergency single-signer path

### 5.2 Resume market

- Entry: `unslash_resume_pool(config, cap, pool, clock)`
- Admin only; after timelock deadline
- Sets `paused = false` and resets slash state for the round

---

## 6. Positions and risk observation

- `/positions` shows new note type labels:
  - Variance Swap
  - Structured Note
  - Range Note
  - Barrier Note
- Cross-Margin VaR frontend covers these products.

---

## 7. Troubleshooting

### 7.1 `Function not found`

Still using old `Package ID`. Check frontend env and wallet package target.

### 7.2 Structured / Range parameter errors

- Structured Note: requires `C > K`
- Range Note: requires `U >= L`

### 7.3 `insufficient_equity` (slash)

Slash amount exceeds pool collateral. Lower `amount_usdc` and retry.

---

## 8. Relation to mainnet

Phase 3 delivers core protocol interfaces and product forms; before mainnet still recommended:

- Audit and security drills
- Risk parameter baselines (default K/C/L/U/B per note type)
- Automated alerts and governance (with `SlashRecord` and `ZkVerification`)
- Run mainnet readiness checklist: `docs/mainnet-readiness-checklist.md`
