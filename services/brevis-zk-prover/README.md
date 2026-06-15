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

# Brevis ZK Prover

**English** | [简体中文](./README.zh.md)

PRD §3.6 · Phase 3 — **Asynchronous ZK oversight path** (does not block the `buy_*` hot path).

## Architecture

```
MarketPool state changes (checkpoint / parameters / liability)
  → Off-chain audit (max-loss / parameter bounds)
  → mock: local SHA-256 proof hash
  → live: Brevis RPC (optional) → fallback to local hash on failure
  → submit_proof → verify_proof_with_policy (committee threshold)
  → Admin finalize_verification after 3600s challenge window
```

> Brevis has no native Sui Move verifier yet; this service maps Brevis proof output to `zk_coprocessor` `proof_hash` / `public_inputs_hash`. On-chain logic remains Attestation + challenge constraints, consistent with [tier2-decision.md](../../docs/tier2-decision.md).

## Initialization

```powershell
.\scripts\init-zk-verifier-policy.ps1 -PackageId 0x... -VerifierAddress 0x...
.\scripts\bootstrap-services-env.ps1
```

## Environment

| Variable | Description |
|------|------|
| `ZK_VERIFIER_POLICY_ID` | Shared object created by `init_verifier_policy` |
| `ZK_PROVER_POOL_IDS` | List of pool IDs to audit |
| `ZK_PROVER_MODE` | `mock` (default) or `live` |
| `ZK_PROVER_DRY_RUN` | Default `true`; set `false` to submit on-chain |
| `BREVIS_RPC_URL` | Brevis Prover RPC for live mode (optional) |

## Run

```powershell
cd services/brevis-zk-prover
npm install
npm run dev
# GET http://localhost:8794/health
```

## Tests

```powershell
npm test
```
