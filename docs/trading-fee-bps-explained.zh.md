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

# 交易费率（bps）详解

> **版本：** v1.0 · **日期：** 2026-06-19  
> **类型：** 本地归档（对话整理）  
> **范围：** 预测市场 Pool 的交易费率、动态 LP Guard、扣费机制与治理参数  
> **关联：** [mainnet-governance-params.zh.md](./mainnet-governance-params.zh.md) · [phase2-playbook.zh.md](./phase2-playbook.zh.md) · [prophet-market-and-encryption-guide.zh.md](./prophet-market-and-encryption-guide.zh.md) · [glossary.zh.md](./glossary.zh.md)

---

## 摘要

在 X-Market Sui 中，**bps（basis points，基点）** 是费率的标准计量单位：**1 bps = 0.01% = 1/10,000**。每笔 `buy_*` 交易按**有效费率**从用户支付中扣费，差额留在 Vault 归 LP；有效费率 = 建池时固定的**基础费率** × LP Guard **动态乘数**。本文说明 bps 含义、链上扣费流程、Keeper 动态抬费逻辑，以及与滑点、Prophet 协议费的区别。

---

## 1. bps 是什么？

| bps | 百分比 | 100 USDC 买入扣费 |
|-----|--------|-------------------|
| 30 | 0.30% | 0.30 USDC |
| 50 | 0.50% | 0.50 USDC |
| 200 | 2.00% | 2.00 USDC |
| 500 | 5.00% | 5.00 USDC |
| 800 | 8.00% | 8.00 USDC（主网有效费率上限） |

**换算口诀：** 除以 100 得百分比，除以 10,000 得小数比例。

---

## 2. 两种费率：基础 vs 有效

| 概念 | 链上字段 | 谁设置 | 含义 |
|------|----------|--------|------|
| **基础费率** | `fee_bps` | 建池时固定 | 市场的「底牌」费率 |
| **费率乘数** | `fee_multiplier_bps` | LP Guard 动态调整 | 在基础费率上的加成比例 |
| **有效费率** | 计算值 | — | 实际扣费比例 |

### 2.1 有效费率公式

链上与前端、Keeper 一致：

```
有效费率 = fee_bps × (10_000 + fee_multiplier_bps) / 10_000
```

等价于：

```
有效费率 = 基础费率 × (1 + 乘数/100%)
```

链上实现（`sources/lp_guard.move`）：

```move
/// Effective fee bps after multiplier: base * (10_000 + mult) / 10_000.
public fun effective_fee_bps(base_fee_bps: u16, fee_multiplier_bps: u16): u16 {
    (((base_fee_bps as u64) * (10_000 + (fee_multiplier_bps as u64))) / 10_000) as u16
}
```

前端（`app/src/lib/position-display.ts`）：

```typescript
export function effectiveFeeBps(pool: PoolView): number {
  return Math.floor((pool.feeBps * (10_000 + pool.feeMultiplierBps)) / 10_000);
}
```

### 2.2 数值示例

| 基础费率 | 乘数 | 乘数含义 | 有效费率 |
|----------|------|----------|----------|
| 30 bps | 2000 | +20% | 36 bps |
| 30 bps | 5000 | +50% | 45 bps |
| 200 bps | 30000 | +300% | 800 bps（主网上限） |

测试用例见 `sources/lp_guard_tests.move`：`effective_fee_bps(30, 2000) == 36`。

---

## 3. 基础费率 `fee_bps`：建池时确定

创建市场时在表单填写 **「交易费率（bps）」**（`/markets/create`），写入 `MarketPool.fee_bps`，**建池后不可改**。

| 环境 / 来源 | 典型值 | 说明 |
|-------------|--------|------|
| 全局默认 | **30 bps** | `GlobalConfig.default_fee_bps`（`sources/config.move`，参考值） |
| Testnet 联调 | 30 bps | 种子市场、脚本默认值 |
| 主网基线 | **200 bps (2%)** | 见 [mainnet-governance-params.zh.md](./mainnet-governance-params.zh.md) |
| 前端校验 | **0–500 bps** | `app/src/lib/create-market.ts` |

CLI 示例（最后一个参数 `30` 即 30 bps）：

```bash
sui client call --package $PKG --module pool --function create_poisson_pool_with_feed \
  --args $ORACLE_CONFIG $FEED_REGISTRY 25 $MATURITY_TS 30 \
  "vector<u8>:MY_FEED_ID" "vector<u8>:规则说明" \
  --gas-budget 150000000
```

---

## 4. 费率如何扣：全额进 Vault，净额算仓位

每笔 `buy_*`（Poisson / Dirichlet / Normal / Beta 等）流程如下：

1. 用户支付 `stake_raw`（全额 USDC）
2. 计算 `fee_eff = effective_fee_bps(fee_bps, fee_multiplier_bps)`
3. 计算 `stake = net_stake_after_fee(stake_raw, fee_eff)`（扣费后的净投入）
4. **全额** `payment` 存入 Vault（`coin_util::deposit_to_vault`）
5. 用 **净 stake** 做 AMM 定价、建仓、计 liability

### 4.1 净 stake 计算

```move
public fun net_stake_after_fee(stake: u64, effective_fee_bps: u16): u64 {
    let keep = 10_000u64 - (effective_fee_bps as u64);
    let net = ((stake as u128) * (keep as u128)) / 10_000;
    net as u64
}
```

### 4.2 数值示例

- 支付 **1,000,000**（1 USDC，6 位小数）
- 有效费率 **50 bps**
- 净 stake = `1,000,000 × 9950 / 10_000 = 995,000`
- **5,000（0.005 USDC）** 留在 Vault，归 LP

### 4.3 费率去向

没有单独「协议交易费」金库；扣费部分与全额支付一并进入 Vault，**LP 通过 NAV 分享**。这与 Prophet 付费解锁的协议费（见 §7）不同。

---

## 5. 动态费率：LP Guard 机制

`fee_multiplier_bps` 由池 authority 通过 `pool::set_lp_guard_params` 手动设置，或由 **LP Guard Keeper**（`services/lp-guard-keeper`）自动调整。

### 5.1 何时抬费？

Keeper 综合三类风险信号：

| 信号 | 权重 | 含义 |
|------|------|------|
| 参数漂移 | 40% | 窗口内 μ / λ / α 变化幅度 |
| 单边偏度 | 35% | 连续同向参数更新或 Dirichlet 集中度 |
| 成交量冲击 | 25% | `collateral_usdc` 增量相对 EMA |

- 风险升高 → 提高 `fee_multiplier_bps`（例：基础 200 bps → 有效最高 800 bps）
- 风险消退 → 乘数每 tick × **0.85** 衰减

详见 [phase2-playbook.zh.md](./phase2-playbook.zh.md) §1.3 与 [services/lp-guard-keeper/README.zh.md](../services/lp-guard-keeper/README.zh.md)。

### 5.2 主网治理上限

| 参数 | 主网确认值 | 环境变量 / 字段 |
|------|------------|-----------------|
| 基础费率 | **200 bps** | `fee_bps`（建池时） |
| 费率乘数上限 | **30000** (+300%) | `LP_GUARD_MAX_FEE_MULTIPLIER_BPS` |
| 有效费率上限 | **800 bps (8%)** | `LP_GUARD_MAX_EFFECTIVE_FEE_BPS` |
| 更新阈值 | **200 bps** | `LP_GUARD_UPDATE_THRESHOLD_BPS` |
| 衰减系数 | **0.85** | `LP_GUARD_DECAY_FACTOR` |

### 5.3 手动设置示例

```powershell
.\scripts\set-lp-guard.ps1 -PoolId 0x你的PoolID `
  -FeeMultiplierBps 5000 `
  -SigmaVirtualTenths 2 `
  -ConcentrationVirtual 10 `
  -DepositCutoffBps 1000 `
  -ResolutionWindowTs 3600
```

`FeeMultiplierBps 5000` 表示 +50%：基础 30 bps → 有效 45 bps。

---

## 6. 在哪里观测？

| 入口 | 内容 |
|------|------|
| `/markets/create` | 建池时填写「交易费率（bps）」 |
| `/markets/[id]` IV / LP Guard 面板 | 基础费率、费率乘数、有效费率 |
| 链上 `MarketPool` | `fee_bps`、`fee_multiplier_bps` |
| Indexer API | 池快照含上述字段 |

面板 i18n 键：`iv.feeBase`、`iv.feeMult`、`iv.feeEffective`（`app/src/i18n/messages/zh.ts`）。

---

## 7. 费率 vs 滑点 vs 其他 bps

项目中多种「bps」用途不同，勿混淆：

| 类型 | 机制 | 受益者 | 模块 |
|------|------|--------|------|
| **交易费率** | 每笔 `buy_*` 固定比例扣费 | LP（Vault） | `lp_guard` / `pool` |
| **AMM 滑点** | 大额买入推动 μ/λ/α，抬高成交价 | LP（隐含在定价中） | `math_*` / `risk` |
| **Prophet 协议费** | 付费解锁 escrow 的 **500 bps (5%)** | 协议 treasury | `prophet_registry` |
| **Slash 上限** | 单次 3000 bps、周期 5000 bps | 治理惩罚 | `slash` |
| **deposit_cutoff_bps** | 生命周期末段禁止 LP 申购 | 风控窗口 | `lp_guard` |

交易费率是**显式、可配置、可动态**的；滑点是 AMM 曲线移动的**隐性成本**。LP 净收益 ≈ 显式费率 + 滑点收入 − 知情交易者赔付。

PRD 盈亏平衡示例：100k 池、约 2% 综合「摩擦」，需 **>500k USDC** 成交量才可能覆盖单笔大额赔付风险（见 [qa.zh.md](./qa.zh.md)）。

---

## 8. 设计意图

1. **基础费率（`fee_bps`）**：建池者为 LP 服务定价的「底价」，主网建议 200 bps。
2. **动态乘数（`fee_multiplier_bps`）**：单边砸盘、参数剧变时自动抬费，保护 LP 免受知情套利。
3. **bps 整数化**：链上避免浮点，统一以 10,000 为分母，与 Move / TypeScript / Keeper 三端一致。
4. **全额进 Vault、净额算仓**：实现简单、审计清晰；费率即 Vault 增量中「未转化为 liability 的部分」。

---

## 9. 相关源码索引

| 路径 | 说明 |
|------|------|
| `sources/lp_guard.move` | `effective_fee_bps`、`net_stake_after_fee` |
| `sources/pool.move` | 各 `buy_*` 入口扣费 + `set_lp_guard_params` |
| `sources/market_pool.move` | `fee_bps`、`fee_multiplier_bps` 字段 |
| `sources/config.move` | `default_fee_bps: 30` |
| `services/lp-guard-keeper/src/risk-engine.ts` | 动态乘数计算 |
| `app/src/lib/position-display.ts` | 前端有效费率展示 |
| `app/src/lib/create-market.ts` | 建池 0–500 bps 校验 |

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-19 | v1.0 | 初版：对话整理归档 |
