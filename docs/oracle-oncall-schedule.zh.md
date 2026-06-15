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

**简体中文** | [English](./oracle-oncall-schedule.md)

# Oracle 运营排班与 SLA（P1.2）

> 关联：[oracle-playbook.md](./oracle-playbook.md) · [p1-services-runbook.md](./p1-services-runbook.md)

## 值班角色

| 角色 | 职责 | 响应 SLA |
|------|------|----------|
| **Primary Proposer** | `event_ts` 到达后 4h 内 `propose_data` | P1：4h |
| **Backup Proposer** | Primary 不可用时接管提议 | P1：8h |
| **Dispute Monitor** | 争议窗口内监控 `AssertionDisputed` / 仲裁委员会 | P1：1h 内确认 |
| **Committee Lead** | `ArbitrationCaseOpened` 后组织多签投票 | P1：24h 内首轮投票 |
| **Ops On-call** | 服务健康、Gas 余额、Relayer 提醒 | P1：30min |

## 每周排班模板

| 周次 | Primary | Backup | Committee Lead | Ops |
|------|---------|--------|----------------|-----|
| W-1 | _姓名_ | _姓名_ | _姓名_ | _姓名_ |
| W0（上线周） | _姓名_ | _姓名_ | _姓名_ | _姓名_ |

填写后归档至 `docs/oncall/YYYY-MM-schedule.md`（人工维护）。

## 自动化提醒（P1.3）

`oracle-relayer` 服务每 2 分钟扫描种子池 `DataFeed`：

| 条件 | 日志事件 | 动作 |
|------|----------|------|
| `now >= event_ts` 且无 active assertion | `oracle_relay_reminder` `propose_ready` | Primary Proposer 提议 |
| 距 72h nullify 不足 6h | `nullify_soon` | 升级至 Backup + Committee Lead |
| 已过 nullify 截止 | `nullify_overdue` | 紧急：协议运营评估 `nullify_feed` |

配置 `ALERT_WEBHOOK_URL` 可对接 Slack/PagerDuty。

## 升级路径

```
Relayer 提醒 → Primary（4h）
  → 无响应 → Backup（+4h）
    → nullify_soon → Committee Lead + 协议运营
      → nullify_overdue → 事故响应（P0 演练 B/D 流程）
```

## 交接清单（每次换班）

- [ ] `verify-services-health.ps1 -IncludeP1` 全绿
- [ ] `check-gas-balances.ps1` 无 low
- [ ] `http://localhost:8790/health` reminders 已处理
- [ ] 打开 `/oracle` 确认无滞留 OPEN feed
- [ ] 阅读 `.run/oracle-relayer.log` 最近 50 行
