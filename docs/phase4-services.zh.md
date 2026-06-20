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

**简体中文** | [English](./phase4-services.md)

# Phase 4 架构：EventRoot · 排行榜

> 回答：统计/排行是否必须本地服务？

## 结论一览

| 能力 | 链上真相源 | 是否必须本地服务 | 说明 |
| --- | --- | --- | --- |
| **战绩 / Prophet Score** | `ProphetRegistry` → DF `ProphetStats` | **否（MVP）** | 前端 RPC + 事件扫描即可 |
| **排行榜页** | 同上 | **否（MVP）** | `/leaderboard` 直读链上 |
| **订阅者 ROI 聚合** | 分散在 `PrivateProphecy` + 审计事件 | **建议 Indexer** | 非关键路径，可 Phase 4+ |
| **LP Guard Keeper** | `MarketPool.fee_multiplier_bps` 等 | **否** | 动态费率自动调控；见 `services/lp-guard-keeper/` |
| **EventRoot** | `event_root.move` shared object | **否** | 纯链上；迁移脚本链下一次性 |

**原则：** 排行与战绩的**权威性**来自链上 `prophet_leaderboard`；本地服务只做**加速、聚合与体验**，不做第二真相源。

---

## EventRoot（L1 市场根）

**模块：** `sources/event_root.move`（`create_and_link` 一键包装迁移）

```
EventRoot (shared)
  ├─ DF b"amm"              → MarketPool ID
  ├─ DF b"prophet_registry" → ProphetRegistry ID
  └─ oracle_feed_id · lock_time · status
```

**当前 Testnet 过渡：** `MarketPool` + `DataFeed.market_id` 充当事实根；新市场可逐步改用 `create_event_root` + `link_*`。

**本地服务：** 仅需一次性迁移脚本 `scripts/wrap-event-roots-testnet.ps1`，非运行时依赖。

---

## 排行榜

### MVP（已实现）

1. `queryEvents(ProphecyCommitted)` 收集预言家地址
2. `getDynamicFieldObject(registry, prophet)` 读取 `ProphetStats`
3. 客户端排序 → `/leaderboard`

### 生产增强（可选 Indexer）

| 索引表 | 用途 |
| --- | --- |
| `prophet_stats` | 缓存 Score、排名变化 |
| `prophecy_index` | 按市场/时间列出预测 |
| `buyer_roi` | 订阅者跟随收益（需关联 unlock + audit 结果） |

Indexer **不参与**付费开通判定；门槛由链上 `paid_unlock_eligible` 强制。

---

## 预言家付费开通门槛（PRD §11.3.7）

链上 `commit_private_prophecy` 当 `unlock_price > 0` 时检查：

- `cheats == 0`
- `total_audited >= 3`
- `score_bps >= 4000`（40/100）

新预言家须先发布 **`unlock_price = 0`** 免费预测，经 Oracle 审计积累战绩后方可收费。Prophet 链上交易（Commit / Unlock / Audit）由用户钱包自付 SUI Gas。
