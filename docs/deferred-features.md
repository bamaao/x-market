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

# 延期功能清单（Beta · UMA DVM · Normal 竞价）

> **版本：** v1.1 · **日期：** 2026-06-08  
> **状态：** Beta / UMA / Normal 竞价均已实现  
> **关联：** [tier2-decision.md](./tier2-decision.md) · [math-spec/SPEC.md](../math-spec/SPEC.md) §7 · [p2-indexer-runbook.md](./p2-indexer-runbook.md) §P2.6 · [phase1.5-playbook.md](./phase1.5-playbook.md)

---

## 摘要

以下三项在 PRD / math-spec 中有规划。**Beta CDF、UMA DVM、Normal Opening Auction 均已于 2026-06-08 实现。**

| 能力 | 完整实现？ | 已有替代 | 主网前必做？ |
| --- | --- | --- | --- |
| **Beta 分布** | ✅ | Dirichlet 二/三分类近似 | 否 |
| **UMA DVM** | ✅ | `OracleArbitrator` 内置多签委员会（`adapter_type=0`） | 可选（双适配器并存） |
| **Normal Opening Auction** | ✅ | `create_normal_pool` 仍可用于直连 Trading | 否 |

---

## 1. Beta 分布 — 已实现（2026-06-08）

### 1.1 实现摘要

| 项 | 状态 | 位置 |
| --- | --- | --- |
| `math_beta` Beta CDF / 区间概率 | ✅ | `sources/math/beta.move` |
| `KIND_BETA = 3` | ✅ | `market_pool.move` |
| `create_beta_pool` / `buy_beta_interval` | ✅ | `pool.move` |
| `update_beta_buy` / LP 缩放 | ✅ | `math_beta` + `deposit_liquidity` |
| 结算（整数 % 0–100） | ✅ | `settlement.move` |
| Max-Loss（101 档 liability） | ✅ | `risk::zero_liability_beta` |
| 单元测试 | ✅ | `math_beta_tests.move`（75/75 全量通过） |
| Web / Mobile | ✅ | `markets.ts` · `TradePanel` · Flutter |

### 1.2 设计要点

- **形状参数：** `α`、`β` 存于 `dirichlet_alphas[0..1]`，`dirichlet_len=2`。
- **区间编码：** 买入参数为 **permille**（0–1000，如 350–400 = 35%–40%）；仓位与结算用 **整数百分比** 0–100。
- **CDF：** 整数 `(α, β)` 二项恒等式 + Q32.32 定点；对称变换减少项数。
- **参数更新：** 按区间中心 vs 均值方向递增 `α` 或 `β`，并双向加集中度。

**创建池：**

```powershell
sui client call --package $PKG --module pool --function create_beta_pool \
  --args 10 10 $MATURITY 30
```

**买入区间：**

```powershell
sui client call --package $PKG --module pool --function buy_beta_interval \
  --args $POOL $USDC 350 400 $CLOCK
```

---

## 2. UMA DVM 适配器 — 已实现（2026-06-08）

### 2.1 实现摘要

| 项 | 状态 | 位置 |
| --- | --- | --- |
| `adapter_type`（builtin / uma_dvm） | ✅ | `OracleArbitrator` |
| `create_uma_dvm_arbitrator` | ✅ | `oracle_arbitrator.move` |
| 出站 `UmaDvmArbitrationRequested` | ✅ | 争议同 PTB 发射 |
| 入站 `execute_uma_dvm_arbitration` | ✅ | allowlisted Relayer |
| 链下 Relayer（mock / live 占位） | ✅ | `services/uma-dvm-relayer/` |
| Indexer `arbitration_adapter` | ✅ | `migrations/004_uma_dvm.sql` |
| 前端 Oracle / 案件面板 | ✅ | adapter 徽章 + UMA 流程提示 |

**Testnet 初始化：**

```powershell
.\scripts\init-uma-dvm-arbitrator.ps1 -PackageId 0x... -RelayerAddress 0x...
.\scripts\bootstrap-services-env.ps1
cd services/uma-dvm-relayer && npm install && npm start
```

---

## 3. Normal Opening Auction — 已实现（2026-06-08）

### 3.1 实现摘要

| 项 | 状态 | 位置 |
| --- | --- | --- |
| `start_normal_auction` | ✅ | `pool.move` |
| `finalize_normal_auction` | ✅ | `pool.move` + `market_pool.move` |
| 桶 → (μ, σ) 定标 | ✅ | `math_normal::mu_sigma_tenths_from_auction_buckets` |
| Web / Mobile 拍卖 UI | ✅ | `AuctionPanel` · `auction.ts` · Flutter |

---

## 4. 与 Tier 2 决策的关系

[tier2-decision.md](./tier2-decision.md) 决议主网前不上 **Tier 2 联合 PDF**。本文三项均属 **Tier 1 扩展或 Oracle 治理增强**，与 Tier 2 无依赖关系。

---

## 5. 验证清单

### Beta

- [x] `sui move test` 含 `math_beta_tests`
- [x] 前端 / Mobile 可交易 Beta 池（`buy_beta_interval`）
- [ ] `math-spec/test-vectors.json` 正式 Beta 向量（待 reference crate 扩展）
- [ ] Testnet 种子池 `NEXT_PUBLIC_POOL_BETA` 部署后填 env

### UMA DVM

- [x] Move 适配器 + mock Relayer
- [ ] `UMA_DVM_MODE=live` 对接真实 UMA API
- [ ] Testnet 完整争议 → mock Relayer → callback 闭环演练

### Normal 竞价

- [x] 全链脚本 + Web/Mobile UI

---

## 6. 修订记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-06-08 | v1.0 | 初版：Beta / UMA DVM / Normal 竞价缺口 |
| 2026-06-08 | v1.1 | Beta CDF 完整实现；三项均标为已实现 |
