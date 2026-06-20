**简体中文** | [English](./poisson-lambda-guide.md)

# Poisson 池参数 λ（tenths）设置指南

> **日期：** 2026-06-19  
> **场景：** 创建预测市场时如何设置 Poisson 分布的 `lambda_tenths`，以世界杯进球预测为例。

---

## 1. λ（tenths）是什么？

`lambda_tenths` 是 Poisson 池的核心参数，用**整数**存储「十分位」刻度：

```
实际 λ = lambda_tenths / 10
```

| 示例 tenths | 实际 λ | 含义 |
|-------------|--------|------|
| 25 | 2.5 | 预期场均 2.5 球 |
| 30 | 3.0 | 预期场均 3.0 球 |
| 15 | 1.5 | 预期场均 1.5 球 |

链上存储于 `MarketPool.lambda_tenths`（`u16`），通过 Q32.32 定点数换算：

```move
// sources/math/fixed_point.move
public fun from_tenths(v: u64): u128 {
    from_u64(v) / 10
}
```

### 有效范围

| 项目 | 值 |
|------|-----|
| 链上上限 | **80** → λ ∈ [0, 8.0] |
| 前端创建校验 | **1–80**（必须 > 0） |
| 产品默认示例 | **25**（λ = 2.5） |
| 结算 outcome | **slot 0–14**（单场总进球 k ≤ 14） |

---

## 2. 三种设置方式

### 2.1 创建 Trading 池时手动指定

创建者调用 `create_poisson_pool` 或 `create_poisson_pool_with_feed`，直接传入 `lambda_tenths`：

```move
// sources/pool.move
public entry fun create_poisson_pool(
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    if (lambda_tenths > 80) {
        abort errors::out_of_bounds()
    };
    // ...
}
```

- 前端创建页默认 `"25"`，校验范围 1–80
- `deploy/testnet.json` 等配置示例：`lambdaTenths: 25`

### 2.2 竞价池定标（Auction）

不确定初始 λ 时，可走竞价发现流程：

1. `start_poisson_auction` → 初始 `lambda_tenths = 0`
2. 用户向 3 个桶投 USDC（`auction_bid`）：

   | 桶索引 | 含义 | 对应 λ |
   |--------|------|--------|
   | 0 | 低进球 | ≈ 1.5 |
   | 1 | 中等 | ≈ 2.5 |
   | 2 | 高进球 | ≈ 5.0 |

3. 竞价结束后 `finalize_poisson_auction` 按加权平均定标：

```
λ_tenths = (15 × b₀ + 25 × b₁ + 50 × b₂) / (b₀ + b₁ + b₂)
```

权重 15 / 25 / 50 分别对应 1.5 / 2.5 / 5.0，结果上限 80。

### 2.3 交易时动态更新

用户买入区间或数字期权后，λ 随交易自动调整：

```
delta_prob = stake / (vault + stake)
target     = P(λ, [a,b]) + delta_prob
λ'         = 在 [0, 80] 上二分搜索，使 poisson_interval(λ', a, b) ≥ target
```

- 买「大球 / 高区间」会把 λ 推高
- 追加 LP 流动性**不会**改变 λ（只增厚 vault）

---

## 3. λ 的用途

| 用途 | 说明 |
|------|------|
| **定价** | `buy_poisson_interval` / `buy_poisson_digital` 用当前 λ 计算 `poisson_interval` / `poisson_pmf` |
| **展示** | 前端显示 `(lambdaTenths / 10).toFixed(1)`，如「λ = 2.5 球/场」 |
| **结算** | Oracle 写入 `resolved_value`（k ∈ 0–14），与 λ 无关 |

---

## 4. 世界杯进球预测：先界定范围

**关键前提：** Poisson 池只适用于**单场比赛**总进球（0–14 球），**不适用于整届世界杯总进球**（约 150–180 球）。

| 预测对象 | 适用模型 | 参数 |
|---------|---------|------|
| **某一场比赛**总进球（0–14） | **Poisson** | `λ（tenths）` |
| **整届世界杯**总进球（≈150–180） | **Normal wide** | `mu_units` / `sigma_units` |
| 某队 / 某阶段进球 | 视数值范围 | Poisson 或 Normal |

链上约束：

- Poisson：`k ∈ [0, 14]`，`λ ≤ 8.0`
- 整届总进球约 170 → **超出 Poisson 建模范围**

---

## 5. 场景 A：某场世界杯比赛总进球

### 设置公式

```
λ（tenths）= 预期场均进球 × 10
```

### 经验参考值

| 场景 | 经验预期 λ | 建议 tenths |
|------|-----------|-------------|
| 普通联赛 / 小组赛 | 2.4–2.7 | **24–27** |
| 产品默认示例 | 2.5 | **25** |
| 进攻型、大比分可能 | 2.8–3.2 | **28–32** |
| 保守防守、0:0 常见 | 2.0–2.3 | **20–23** |
| 世界杯决赛（偏保守） | 2.2–2.6 | **22–26** |

### 示例

预测「法国 vs 阿根廷，全场总进球」：

- 预期约 **2.6 球/场** → 创建时填 **`26`**
- 前端显示 **λ = 2.6 球/场**
- 用户可买区间 `[2,3]`、数字期权 `k=4` 等
- Oracle 结算：该场实际总进球（0–14）

### 不确定初始 λ 时

使用竞价池 `start_poisson_auction`，由市场三桶资金加权定标。

---

## 6. 场景 B：整届世界杯总进球

应改用 **Normal wide 池**（`create_normal_pool_wide`），**不要**使用 Poisson 的 `λ（tenths）`。

```move
// sources/pool.move
public entry fun create_normal_pool_wide(
    mu_units: u64,
    sigma_units: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
)
```

### 参数建议（48 队、约 104 场）

| 参数 | 含义 | 建议值 |
|------|------|--------|
| `mu_units` | 预期总进球 | **165–175**（2018≈169，2022≈172） |
| `sigma_units` | 不确定性 | **12–20** |

### 示例

- 预期总进球 **172** → `mu_units = 172`
- 认为 95% 落在 140–200 → `sigma_units ≈ 15`
- 用户买区间如 `[160, 180]`
- Oracle 结算写入实际总进球（整数 units）
- 标题须写清：「2026 世界杯全部比赛总进球」

---

## 7. 场景 C：世界杯主题 + Poisson

若坚持使用 Poisson 模型：

- 为**每场比赛**单独建 Poisson 池（各自设置 λ）
- 或建「决赛总进球」等**单场**市场

---

## 8. 快速对照表

| 场景 | 模型 | 参数设置 |
|------|------|---------|
| 直接建 Trading 池 | Poisson | 创建交易填 `lambda_tenths`（如 25） |
| 不确定初始 λ | Poisson Auction | 三桶 USDC 加权 → `finalize_poisson_auction` |
| 已有 Trading 池 | Poisson | 每笔买入自动 `update_lambda_buy` |
| 单场世界杯比赛 | Poisson | `λ（tenths）` = 预期场均 × 10，常用 **25–28** |
| 整届世界杯总进球 | Normal wide | `mu_units ≈ 170`，`sigma_units ≈ 15` |

---

## 9. 一句话总结

- **单场进球** → Poisson，`λ（tenths）` = 预期场均进球 × 10；世界杯单场常用 **25–28**
- **整届总进球** → Normal wide 的 `mu_units`（约 **170**），**不要**设 `λ（tenths）`

---

## 相关代码与文档

| 路径 | 说明 |
|------|------|
| `sources/math/poisson.move` | Poisson PMF、区间概率、λ 更新、竞价定标 |
| `sources/pool.move` | 池创建、买入、竞价入口 |
| `sources/market_pool.move` | `MarketPool.lambda_tenths` 字段 |
| `math-spec/SPEC.md` §4 | Poisson 数学规格 |
| `app/src/lib/markets.ts` | 种子市场示例 `lambda_tenths: 25` |
| `PRD.zh.md` §2.8.1 | 足球进球区间结算示例 |
