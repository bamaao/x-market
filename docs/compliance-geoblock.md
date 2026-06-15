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

**English** | [简体中文](./compliance-geoblock.zh.md)

# GeoBlock & Compliance (P3.4)

X-Market is a non-custodial on-chain protocol; frontend GeoBlock only restricts **web app access** and does not prevent direct chain interaction.

## Configuration

| Variable | Description |
|------|------|
| `GEO_BLOCK_ENABLED` | `true` to enable |
| `GEO_BLOCKED_COUNTRIES` | ISO 3166-1 alpha-2, comma-separated, e.g. `US,CN,IR` |

## Deployment Recommendations

- **Vercel:** automatically provides `x-vercel-ip-country`
- **Cloudflare:** use `cf-ipcountry`
- **Self-hosted:** reverse proxy injects `x-geo-country`

## Disclaimer Template

The blocked page (`/blocked`) should link to the operator's compliance policy. Legal must confirm prohibited jurisdictions before mainnet launch.

## Non-goals

- Does not replace KYC/AML processes
- Does not block RPC / direct contract calls
- Mobile apps require separate geo distribution handling at the app store level
