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

**English** | [简体中文](./mainnet-infra-priority.zh.md)

# X-Market Sui Mainnet Infrastructure Priority List

> **Version:** v1.0 · **Date:** 2026-06-06  
> **Related:** [mainnet-readiness-checklist.md](./mainnet-readiness-checklist.md) · [mainnet-governance-params.md](./mainnet-governance-params.md) · [phase4-services.md](./phase4-services.md)

Ordered by **P0 blockers → P1 launch week → P2 30 days → P3 growth → P4 scale**. Check status as releases progress.

---

## P0 — Mainnet Blockers (must complete before launch)

| # | Item | Status | Owner | Notes / deliverable |
|---|-----|------|--------|-------------|
| 0.1 | Move external audit | [ ] | Protocol | Close all blockers; archive report |
| 0.2 | Mainnet contract publish + permission migration | [ ] | Protocol | `AdminCap` / `GlobalConfig` → cold wallet or multisig; Circle USDC |
| 0.3 | Testnet upgrade verification (`unlock_price=0`) | [x] | Protocol | v3 `0x2e368e…ae6e`; tx `8K2jBvsTUK9FQAmncX7KsbFhTu4RpZvqidL4vMMqWmob` |
| 0.4 | Gas Station production deployment | [x] | Backend | Testnet staging: `scripts/bootstrap-services-env.ps1` + `start-services-testnet.ps1` |
| 0.5 | LP Guard Keeper production deployment | [x] | Backend | Same as above; `LP_GUARD_DRY_RUN=false`; see [services-testnet-runbook.md](./services-testnet-runbook.md) |
| 0.6 | Governance parameter sign-off edition | [~] | Risk | Baseline locked: `governance-params-baseline.json` + `verify-governance-params.ps1`; **dual sign-off pending** |
| 0.7 | Emergency drill (with audit trail) | [~] | Ops | A–D on-chain automation passed: [mainnet-drill-2026-06-06.md](./mainnet-drill-2026-06-06.md); E/F see [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) |

### P0 Automated Checks

```powershell
.\scripts\verify-p0-readiness.ps1
.\scripts\verify-governance-params.ps1
.\scripts\run-p0-drills-testnet.ps1
```

### P0 Service Deployment (Testnet Staging)

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1
```

See [services-testnet-runbook.md](./services-testnet-runbook.md). For mainnet, migrate secrets to KMS/HSM and reuse the same flow.

---

## P1 — Launch Week (non-blocking for publish, ops-critical)

| # | Item | Status | Duration | Notes |
|---|-----|------|------|------|
| 1.1 | Observability and alerts | [x] | 3–5 days | `services/chain-monitor`: `/health` `/metrics` `/alerts`; see [p1-services-runbook.md](./p1-services-runbook.md) |
| 1.2 | Oracle ops runbook + on-call schedule | [x] | 1 day | [oracle-oncall-schedule.md](./oracle-oncall-schedule.md) + [oracle-playbook.md](./oracle-playbook.md) |
| 1.3 | Oracle Relayer (minimum: maturity reminders) | [x] | 1 day+ | `services/oracle-relayer` scans `DataFeed.event_ts` → webhook |
| 1.4 | Mainnet Walrus Upload Relay | [x] | 2–4 days | `services/walrus-relay` proxies `PUT /v1/blobs` |
| 1.5 | RPC high availability | [x] | 1 day | `SUI_RPC_URL_FALLBACK` + `NEXT_PUBLIC_SUI_RPC_URL*` |
| 1.6 | Frontend mainnet config + 8-page regression | [x] | 1 day | [app/.env.mainnet.example](../app/.env.mainnet.example) + [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) |
| 1.7 | Treasury and key ops | [x] | 1–2 days | `check-gas-balances.ps1` · `fund-gas-payer-testnet.ps1` · Gas Station balance webhook |

### P1 Automated Checks

```powershell
.\scripts\verify-p1-readiness.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1 -IncludeP1
.\scripts\check-gas-balances.ps1
```

### P1 Minimum Monitoring Event Set

- `macro_oracle::DataProposed` / `AssertionFinalized` / `AssertionDisputed`
- `oracle_arbitrator::ArbitrationCaseOpened` / `VerdictExecuted`
- `market_pool::PoolPaused` / `SlashRecord`
- `prophet_registry::ProphecyAudited` / `CheatDetected`
- `zk_coprocessor::VerificationChallenged`

---

## P2 — First 30 Days Post-Launch (experience and efficiency)

| # | Item | Status | Duration | Notes |
|---|-----|------|------|------|
| 2.1 | Indexer (full) | [x] | 2–3 weeks | `services/indexer` + Postgres; see [p2-indexer-runbook.md](./p2-indexer-runbook.md) |
| 2.2 | IV history curve | [x] | 1 week | `iv_history` + `IvPanel` Vol Crush chart |
| 2.3 | Feed / market discovery API | [x] | 3–5 days | `GET /v1/markets` `/v1/feeds`; homepage `MarketsGrid` |
| 2.4 | Prophet leaderboard cache | [x] | 3–5 days | `prophet_stats` + `/leaderboard` Indexer-first |
| 2.5 | ArbitrationCase indexing | [x] | 2–3 days | `arbitration_cases` + Oracle dispute panel |
| 2.6 | UMA DVM adapter | [x] | 2–4 weeks | Move + `uma-dvm-relayer` + Indexer; see p2-indexer-runbook §P2.6 |

### P2 Automated Checks

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-p2-readiness.ps1
```

---

## P3 — Growth Phase (60–90 days)

| # | Item | Status | Notes |
|---|-----|------|------|
| 3.1 | Subscriber ROI aggregation | [x] | `/roi` + `buyer_roi_summary` API |
| 3.2 | Pricing Engine / SDK | [x] | `pricing-engine/` HTTP `:8801` + `TradePanel` preview |
| 3.3 | Seal expiry plaintext Indexer cache | [x] | `seal_plaintext_cache` worker + API |
| 3.4 | GeoBlock / compliance | [x] | `middleware.ts` + [compliance-geoblock.md](./compliance-geoblock.md) |
| 3.5 | Mobile mainnet config | [x] | `bootstrap-mobile-env.ps1` + `SuiConfig.network` |

### P3 Automated Checks

```powershell
.\scripts\verify-p3-readiness.ps1
.\scripts\bootstrap-mobile-env.ps1 -Network testnet
cd pricing-engine && npm start
```

---

## P4 — SuiProphet Scale (90–120 days)

| # | Item | Status | Notes |
|---|-----|------|------|
| 4.1 | Prophet Audit Keeper | [x] | `services/prophet-audit-keeper` auto `audit_prophecy` |
| 4.2 | EventRoot indexing + API | [x] | `event_roots` + `/v1/event-roots` |
| 4.3 | Prophet frontend closed loop | [x] | Indexer prophecy list + plaintext cache decrypt |
| 4.4 | Prophet GMV ops metrics | [x] | `prophet_gmv_daily` + `/metrics` |

### P4 Automated Checks

```powershell
.\scripts\verify-p4-readiness.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
```

See [p4-scale-runbook.md](./p4-scale-runbook.md).

---

## Recommended Timeline

```
Week -8 ~ -4   P0.1 External audit
Week -3        P0.2–0.3 Contract freeze, final Testnet upgrade
Week -2        P0.4–0.5 Gas Station + LP Guard staging
Week -1        P0.6–0.7 Parameter sign-off + emergency drill; P1.1–1.6 in parallel
Day 0          P0.2 Mainnet publish → seed markets → gradual rollout
Day 1–7        P1.7 on-call; mainnet-readiness §8 observation
Week 2–4       P2.1 Indexer MVP
```

---

## Minimum Viable Mainnet (when resources are tight)

P0 all + P1.1 (basic monitoring) + P1.2 (Oracle on-call) + P1.4 (Walrus Relay) is sufficient to launch; **defer Indexer to weeks 2–4**, but must complete before active markets >50 or Prophet prophecies >200.

---

## Change Log

| Date | Version | Notes |
|------|------|------|
| 2026-06-06 | v1.0 | Initial version; P0 service productionization and verification scripts |
| 2026-06-06 | v1.1 | P1: chain-monitor, oracle-relayer, walrus-relay, RPC fallback, mainnet env template |
| 2026-06-07 | v1.2 | P2: full Indexer (Postgres + API + frontend integration) |
| 2026-06-07 | v1.3 | P3: ROI, Pricing Engine, Seal cache, GeoBlock, Mobile config |
| 2026-06-07 | v1.4 | P4: Audit Keeper, EventRoot indexing, Prophet closed loop, GMV metrics |
