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

# UMA DVM Relayer

**English** | [简体中文](./README.zh.md)

Off-chain service: subscribes to `UmaDvmArbitrationRequested` events and, after DVM voting completes, calls `execute_uma_dvm_arbitration` to write the final verdict on-chain.

## Modes

| `UMA_DVM_MODE` | Behavior |
| --- | --- |
| `mock` (Testnet default) | After `UMA_DVM_MOCK_DELAY_MS`, auto-finalizes per `UMA_DVM_MOCK_VERDICT` |
| `live` | Polls `UMA_API_URL` (placeholder; requires UMA OO/DVM HTTP integration) |

## Prerequisites

1. Publish Move package including `create_uma_dvm_arbitrator`
2. `macro_oracle::set_oracle_arbitrator` binds the UMA adapter object
3. Relayer address is on `uma_relayer_allowlist`

```powershell
.\scripts\init-uma-dvm-arbitrator.ps1 -PackageId 0x... -RelayerAddress 0x...
```

## Start

```powershell
.\scripts\bootstrap-services-env.ps1
cd services/uma-dvm-relayer
npm install
npm start
```

Health check: `GET http://localhost:8793/health`
