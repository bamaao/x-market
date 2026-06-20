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

**English** | [简体中文](./p0-drill-ef-checklist.zh.md)

# P0.7 Drill E/F Checklist

> On-chain A–D are automated by `app/scripts/p0-drills.ts`; this section covers **manual** items. Check them off in [mainnet-drill-2026-06-06.md](./mainnet-drill-2026-06-06.md) when complete.

---

## E. Frontend Critical Page Regression (Testnet)

**Prerequisites:** `app/.env.local` points to the v3 `packageId` from `deploy/testnet-v2.json`; after `npm run dev`, connect a Testnet wallet.

| # | Route | Check | Pass |
|---|------|--------|------|
| E1 | `/` | Home loads, seed market cards, navigation | [ ] |
| E2 | `/markets/[id]` | Poisson / Dirichlet / Normal pool details, buy form, on-chain pool state | [ ] |
| E3 | `/positions` | Position list matches Drill A buy records | [ ] |
| E4 | `/lp` | LP deposit/redeem UI; paused pools show paused state | [ ] |
| E5 | `/oracle` | DataFeed / assertion status read-only display | [ ] |
| E6 | `/prophet` | Prophecy commit (wallet-paid SUI gas; public/paid paths) | [ ] |
| E7 | `/leaderboard` | Prophet leaderboard loads without errors | [ ] |
| E8 | `/margin` | Margin page loads, consistent with pool config | [ ] |

**Sign-off:** Product __________ · Date __________

---

## F. Alert Pipeline & On-call Response (Testnet Staging)

**Prerequisites:** `start-services-testnet.ps1` has started LP Guard (`:8788`).

| # | Scenario | Action | Expected | Pass |
|---|------|------|------|------|
| F1 | Service health | `.\scripts\verify-services-health.ps1` | Both services HTTP 200 | [ ] |
| F2 | Low Gas | Artificially lower Gas Payer SUI (or mock) | `/health` reports low-balance alert field | [ ] |
| F3 | Keeper intervention | Trigger `paused` on seed pool (Drill B/C) | Keeper logs show risk evaluation; dry_run=false does not cause collateral damage | [ ] |
| F4 | On-call runbook | Read [services-testnet-runbook.md](./services-testnet-runbook.md) §On-call | Know restart steps, log paths, contacts | [ ] |
| F5 | Drill record | Write F1–F4 results to drill record §3 | Screenshots or command output summary | [ ] |

### On-call Quick Reference (Testnet)

| Event | Action |
|------|------|
| LP Guard Keeper down | `stop-services-testnet.ps1` → check `services/lp-guard-keeper` logs → `start-services-testnet.ps1` |
| LP Guard repeated failures | Confirm `LP_GUARD_DRY_RUN`, pool authority address, RPC reachable |
| Pool `paused=true` | Check SlashRecord; after timelock, Admin `unslash_resume_pool` |
| ZK dispute window | After 3600s, Admin `finalize_verification` |

**Sign-off:** Ops __________ · Date __________
