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

**English** | [简体中文](./oracle-oncall-schedule.zh.md)

# Oracle Operations Schedule & SLA (P1.2)

> Related: [oracle-playbook.md](./oracle-playbook.md) · [p1-services-runbook.md](./p1-services-runbook.md)

## On-call Roles

| Role | Responsibility | Response SLA |
|------|------|----------|
| **Primary Proposer** | `propose_data` within 4h after `event_ts` | P1: 4h |
| **Backup Proposer** | Take over proposals when Primary unavailable | P1: 8h |
| **Dispute Monitor** | Monitor `AssertionDisputed` / arbitration committee during dispute window | P1: confirm within 1h |
| **Committee Lead** | Organize multisig vote after `ArbitrationCaseOpened` | P1: first vote within 24h |
| **Ops On-call** | Service health, Gas balance, Relayer reminders | P1: 30min |

## Weekly Schedule Template

| Week | Primary | Backup | Committee Lead | Ops |
|------|---------|--------|----------------|-----|
| W-1 | _name_ | _name_ | _name_ | _name_ |
| W0 (launch week) | _name_ | _name_ | _name_ | _name_ |

After filling in, archive to `docs/oncall/YYYY-MM-schedule.md` (manually maintained).

## Automated Reminders (P1.3)

`oracle-relayer` scans seed pool `DataFeed` every 2 minutes:

| Condition | Log Event | Action |
|------|----------|------|
| `now >= event_ts` and no active assertion | `oracle_relay_reminder` `propose_ready` | Primary Proposer proposes |
| Less than 6h until 72h nullify | `nullify_soon` | Escalate to Backup + Committee Lead |
| Past nullify deadline | `nullify_overdue` | Urgent: protocol ops evaluate `nullify_feed` |

Set `ALERT_WEBHOOK_URL` to integrate Slack/PagerDuty.

## Escalation Path

```
Relayer reminder → Primary (4h)
  → no response → Backup (+4h)
    → nullify_soon → Committee Lead + protocol ops
      → nullify_overdue → incident response (P0 drill B/D flow)
```

## Handoff Checklist (Each Shift Change)

- [ ] `verify-services-health.ps1 -IncludeP1` all green
- [ ] `check-gas-balances.ps1` no low balances
- [ ] `http://localhost:8790/health` reminders handled
- [ ] Open `/oracle` and confirm no stale OPEN feeds
- [ ] Read last 50 lines of `.run/oracle-relayer.log`
