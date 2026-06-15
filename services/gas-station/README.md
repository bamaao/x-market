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

# Gas Station (Sponsored Transactions)

**English** | [简体中文](./README.zh.md)

PRD §11.3.6 · Phase 4

## Do You Need a Local Service?

**Yes.** Gas Station requires an off-chain **Gas Payer service**; it cannot be replaced by a frontend-only or on-chain-only setup.

| Component | Deployment | Responsibility |
| --- | --- | --- |
| Gas Payer wallet | Server key store | Holds SUI, signs sponsored transactions as `gasOwner` |
| Sponsor API | `services/gas-station/` | Validate PTB allowlist → dual-sign `TransactionBlock` → broadcast |
| Web App | `app/src/lib/gas-station.ts` | Build user PTB → request sponsorship → wallet signs USDC portion |

## Flow

```
User wallet builds PTB (USDC transfer / unlock / commit only)
        ↓
POST /v1/sponsor { txBytes, sender, allowedMoveCalls[] }
        ↓
Server dry-run validation → Gas Payer signs gasData
        ↓
Return dual-signed bytes → user wallet signs authority → execute
```

## Allowlist (MVP)

- `prophet_registry::commit_private_prophecy` (free practice only when `unlock_price = 0`; supported on-chain in v3 package)
- `prophet_registry::unlock_prophecy`
- `prophet_registry::audit_prophecy`
- `market_pool::buy_*` (optional)

## Environment Variables (Server)

See [.env.example](./.env.example). Production deployment:

```bash
cp .env.example .env.local
# Set GAS_PAYER_PRIVATE_KEY, PACKAGE_ID, CORS_ORIGIN
GAS_STATION_PRODUCTION=true npm start
```

| Variable | Description |
| --- | --- |
| `GAS_PAYER_PRIVATE_KEY` | Gas Payer private key (required in production) |
| `PACKAGE_ID` | Allowlisted package ID (required in production) |
| `GAS_STATION_PRODUCTION` | When `true`, enforces key + non-`*` CORS |
| `GAS_MIN_BALANCE_MIST` | `/health` returns 503 below this balance (default 0.5 SUI) |

## Health Check

```
GET /health
```

Returns `gasOwner`, `gasBalanceMist`, `gasBalanceLow`; `ok: false` when balance is low or configuration is missing.

## Status

- [x] HTTP API implemented (`src/server.ts` — `POST /v1/sponsor`)
- [x] Frontend `useSponsoredTransaction` hook (`app/src/hooks/useSponsoredTransaction.ts`)
- [ ] Testnet Gas Payer funding and monitoring (configure `GAS_PAYER_PRIVATE_KEY` at deploy time)

## Local Start

```bash
cd services/gas-station
npm install
# Export private key via sui keytool export
export GAS_PAYER_PRIVATE_KEY=suiprivkey1...
export PACKAGE_ID=<NEXT_PUBLIC_PACKAGE_ID>
export SUI_RPC_URL=https://fullnode.testnet.sui.io
npm run dev
```

Add to `app/.env.local`:

```
NEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787
```

Users only see USDC changes; SUI gas is paid by the protocol.
