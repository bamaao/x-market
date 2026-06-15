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

# X-Market Sui 主网基础设施优先级清单

> **版本：** v1.0 · **日期：** 2026-06-06  
> **关联：** [mainnet-readiness-checklist.md](./mainnet-readiness-checklist.md) · [mainnet-governance-params.md](./mainnet-governance-params.md) · [phase4-services.md](./phase4-services.md)

按 **P0 阻断 → P1 上线当周 → P2 30 天 → P3 增长期 → P4 规模化** 排列。勾选状态随发布推进更新。

---

## P0 — 主网阻断（上线前必须完成）

| # | 项 | 状态 | 负责人 | 说明 / 产物 |
|---|-----|------|--------|-------------|
| 0.1 | Move 外部专项审计 | [ ] | 协议 | 关闭所有阻断项；报告归档 |
| 0.2 | 主网合约发布 + 权限迁移 | [ ] | 协议 | `AdminCap` / `GlobalConfig` → 冷钱包或多签；Circle USDC |
| 0.3 | Testnet 升级验证（`unlock_price=0`） | [x] | 协议 | v3 `0x2e368e…ae6e`；tx `8K2jBvsTUK9FQAmncX7KsbFhTu4RpZvqidL4vMMqWmob` |
| 0.4 | Gas Station 生产部署 | [x] | 后端 | Testnet 预发：`scripts/bootstrap-services-env.ps1` + `start-services-testnet.ps1` |
| 0.5 | LP Guard Keeper 生产部署 | [x] | 后端 | 同上；`LP_GUARD_DRY_RUN=false`；见 [services-testnet-runbook.md](./services-testnet-runbook.md) |
| 0.6 | 治理参数签字版 | [~] | 风控 | 基线已锁定：`governance-params-baseline.json` + `verify-governance-params.ps1`；**双人签字待完成** |
| 0.7 | 应急演练（留痕） | [~] | 运维 | A–D 链上自动化通过：[mainnet-drill-2026-06-06.md](./mainnet-drill-2026-06-06.md)；E/F 见 [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) |

### P0 自动化检查

```powershell
.\scripts\verify-p0-readiness.ps1
.\scripts\verify-governance-params.ps1
.\scripts\run-p0-drills-testnet.ps1
```

### P0 服务部署（Testnet 预发）

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1
```

详见 [services-testnet-runbook.md](./services-testnet-runbook.md)。主网须将密钥迁入 KMS/HSM 后复用同一流程。

---

## P1 — 上线当周（不阻断发包，运营强依赖）

| # | 项 | 状态 | 工期 | 说明 |
|---|-----|------|------|------|
| 1.1 | 可观测性与告警 | [x] | 3–5 天 | `services/chain-monitor`：`/health` `/metrics` `/alerts`；见 [p1-services-runbook.md](./p1-services-runbook.md) |
| 1.2 | Oracle 运营 Runbook + 排班 | [x] | 1 天 | [oracle-oncall-schedule.md](./oracle-oncall-schedule.md) + [oracle-playbook.md](./oracle-playbook.md) |
| 1.3 | Oracle Relayer（最小：到期提醒） | [x] | 1 天起 | `services/oracle-relayer` 扫 `DataFeed.event_ts` → webhook |
| 1.4 | 主网 Walrus Upload Relay | [x] | 2–4 天 | `services/walrus-relay` 代理 `PUT /v1/blobs` |
| 1.5 | RPC 高可用 | [x] | 1 天 | `SUI_RPC_URL_FALLBACK` + `NEXT_PUBLIC_SUI_RPC_URL*` |
| 1.6 | 前端主网配置 + 8 页回归 | [x] | 1 天 | [app/.env.mainnet.example](../app/.env.mainnet.example) + [p0-drill-ef-checklist.md](./p0-drill-ef-checklist.md) |
| 1.7 | 资金与密钥运维 | [x] | 1–2 天 | `check-gas-balances.ps1` · `fund-gas-payer-testnet.ps1` · Gas Station 余额 webhook |

### P1 自动化检查

```powershell
.\scripts\verify-p1-readiness.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1 -IncludeP1
.\scripts\check-gas-balances.ps1
```

### P1 最小监控事件集

- `macro_oracle::DataProposed` / `AssertionFinalized` / `AssertionDisputed`
- `oracle_arbitrator::ArbitrationCaseOpened` / `VerdictExecuted`
- `market_pool::PoolPaused` / `SlashRecord`
- `prophet_registry::ProphecyAudited` / `CheatDetected`
- `zk_coprocessor::VerificationChallenged`

---

## P2 — 上线后 30 天（体验与效率）

| # | 项 | 状态 | 工期 | 说明 |
|---|-----|------|------|------|
| 2.1 | Indexer（完整） | [x] | 2–3 周 | `services/indexer` + Postgres；见 [p2-indexer-runbook.md](./p2-indexer-runbook.md) |
| 2.2 | IV 历史曲线 | [x] | 1 周 | `iv_history` + `IvPanel` Vol Crush 图 |
| 2.3 | Feed / 市场发现 API | [x] | 3–5 天 | `GET /v1/markets` `/v1/feeds`；首页 `MarketsGrid` |
| 2.4 | Prophet 排行缓存 | [x] | 3–5 天 | `prophet_stats` + `/leaderboard` Indexer 优先 |
| 2.5 | ArbitrationCase 索引 | [x] | 2–3 天 | `arbitration_cases` + Oracle 争议面板 |
| 2.6 | UMA DVM 适配器 | [x] | 2–4 周 | Move + `uma-dvm-relayer` + Indexer；见 p2-indexer-runbook §P2.6 |

### P2 自动化检查

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-p2-readiness.ps1
```

---

## P3 — 增长期（60–90 天）

| # | 项 | 状态 | 说明 |
|---|-----|------|------|
| 3.1 | 订阅者 ROI 聚合 | [x] | `/roi` + `buyer_roi_summary` API |
| 3.2 | Pricing Engine / SDK | [x] | `pricing-engine/` HTTP `:8801` + `TradePanel` 预览 |
| 3.3 | Seal 到期明文 Indexer 缓存 | [x] | `seal_plaintext_cache` worker + API |
| 3.4 | GeoBlock / 合规 | [x] | `middleware.ts` + [compliance-geoblock.md](./compliance-geoblock.md) |
| 3.5 | 移动端主网配置 | [x] | `bootstrap-mobile-env.ps1` + `SuiConfig.network` |

### P3 自动化检查

```powershell
.\scripts\verify-p3-readiness.ps1
.\scripts\bootstrap-mobile-env.ps1 -Network testnet
cd pricing-engine && npm start
```

---

## P4 — SuiProphet 规模化（90–120 天）

| # | 项 | 状态 | 说明 |
|---|-----|------|------|
| 4.1 | Prophet Audit Keeper | [x] | `services/prophet-audit-keeper` 自动 `audit_prophecy` |
| 4.2 | EventRoot 索引 + API | [x] | `event_roots` + `/v1/event-roots` |
| 4.3 | Prophet 前端闭环 | [x] | Indexer 预言列表 + 明文缓存解密 |
| 4.4 | Prophet GMV 运营指标 | [x] | `prophet_gmv_daily` + `/metrics` |

### P4 自动化检查

```powershell
.\scripts\verify-p4-readiness.ps1
.\scripts\start-services-testnet.ps1 -IncludeP4
```

详见 [p4-scale-runbook.md](./p4-scale-runbook.md)。

---

## 推荐时间线

```
Week -8 ~ -4   P0.1 外部审计
Week -3        P0.2–0.3 合约冻结、Testnet 最终升级
Week -2        P0.4–0.5 Gas Station + LP Guard staging
Week -1        P0.6–0.7 参数签字 + 应急演练；P1.1–1.6 并行
Day 0          P0.2 主网发包 → 种子市场 → 灰度
Day 1–7        P1.7 on-call；mainnet-readiness §8 观察
Week 2–4       P2.1 Indexer MVP
```

---

## 最小可行主网（资源紧时）

仅做 P0 全部 + P1.1（基础监控）+ P1.2（Oracle 排班）+ P1.4（Walrus Relay）即可上线；**Indexer 推迟至第 2–4 周**，但在活跃市场 >50 或 Prophet 预测 >200 前必须完成。

---

## 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-06 | v1.0 | 初版；P0 服务生产化与验证脚本落地 |
| 2026-06-06 | v1.1 | P1：chain-monitor、oracle-relayer、walrus-relay、RPC fallback、主网 env 模板 |
| 2026-06-07 | v1.2 | P2：完整 Indexer（Postgres + API + 前端集成） |
| 2026-06-07 | v1.3 | P3：ROI、Pricing Engine、Seal 缓存、GeoBlock、Mobile 配置 |
| 2026-06-07 | v1.4 | P4：Audit Keeper、EventRoot 索引、Prophet 闭环、GMV 指标 |
