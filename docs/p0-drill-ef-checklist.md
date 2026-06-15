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

# P0.7 演练 E/F 检查清单

> 链上 A–D 由 `app/scripts/p0-drills.ts` 自动化；本节为 **手工** 项，完成后在 [mainnet-drill-2026-06-06.md](./mainnet-drill-2026-06-06.md) 勾选。

---

## E. 前端关键页面回归（Testnet）

**前置：** `app/.env.local` 指向 `deploy/testnet-v2.json` 的 v3 `packageId`；`npm run dev` 启动后连接 Testnet 钱包。

| # | 路由 | 检查项 | 通过 |
|---|------|--------|------|
| E1 | `/` | 首页加载、种子市场卡片、导航 | [ ] |
| E2 | `/markets/[id]` | Poisson / Dirichlet / Normal 池详情、买入表单、链上池状态 | [ ] |
| E3 | `/positions` | 持仓列表与 Drill A 买入记录一致 | [ ] |
| E4 | `/lp` | LP 存入/赎回 UI；paused 池显示暂停状态 | [ ] |
| E5 | `/oracle` | DataFeed / 断言状态只读展示 | [ ] |
| E6 | `/prophet` | 预言提交、Gas Station 赞助 commit（`unlock_price=0`） | [ ] |
| E7 | `/leaderboard` | Prophet 排行加载无报错 | [ ] |
| E8 | `/margin` | 保证金页加载、与池配置一致 | [ ] |

**签字：** 产品 __________ · 日期 __________

---

## F. 告警链路与值班响应（Testnet 预发）

**前置：** `start-services-testnet.ps1` 已启动 Gas Station (`:8787`) 与 LP Guard (`:8788`)。

| # | 场景 | 操作 | 预期 | 通过 |
|---|------|------|------|------|
| F1 | 服务健康 | `.\scripts\verify-services-health.ps1` | 两服务 HTTP 200 | [ ] |
| F2 | Gas 不足 | 人为降低 Gas Payer SUI（或 mock） | `/health` 报告余额告警字段 | [ ] |
| F3 | Keeper 干预 | 对种子池触发 `paused`（Drill B/C） | Keeper 日志出现 risk 评估；dry_run=false 时不误伤 | [ ] |
| F4 | 值班手册 | 阅读 [services-testnet-runbook.md](./services-testnet-runbook.md) §On-call | 知晓重启、日志路径、联系人 | [ ] |
| F5 | 演练留痕 | 将 F1–F4 结果写入 drill 记录 §3 | 有截图或命令输出摘要 | [ ] |

### On-call 速查（Testnet）

| 事件 | 动作 |
|------|------|
| Gas Station down | `stop-services-testnet.ps1` → 查 `services/gas-station` 日志 → `start-services-testnet.ps1` |
| LP Guard 连续失败 | 确认 `LP_GUARD_DRY_RUN`、池 authority 地址、RPC 可达 |
| 池 `paused=true` | 查 SlashRecord；timelock 后 `unslash_resume_pool`（Admin） |
| ZK 争议窗口 | 3600s 后 Admin `finalize_verification` |

**签字：** 运维 __________ · 日期 __________
