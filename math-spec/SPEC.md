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

# @x-market/math-spec — Tier 1 链上数学引擎规范

> **版本：** v1.0  
> **日期：** 2026-05-25  
> **适用范围：** Solana (Anchor) · Sui (Move)  
> **上级文档：** [../PRD.md](../PRD.md) §3

两链必须实现**语义等价**的数学行为。链上程序为唯一真相源；链下 Preview Engine 须通过本 spec 的全部测试向量。

---

## 1. 设计原则

1. **有界输入：** 所有函数在调用前必须 `require!` 边界检查，越界则 revert。
2. **定点数唯一：** 禁止链上浮点；统一使用 `Q32.32`（见 §2）。
3. **确定性：** 相同输入 → 相同输出，跨链 bit-exact（输出允许 ±1 ULP 容差，见 §2.4）。
4. **O(1) 优先：** 阶乘、低阶幂次查表；泰勒迭代次数固定上限。
5. **Oracle 禁止参与 Tier 1 定价：** 本 spec 所有函数纯链上调用。

---

## 2. 定点数格式 `Q32.32`

### 2.1 表示

```
类型：无符号 U128（符号场景用 I128 补码，范围见各函数）
缩放：SCALE = 2^32 = 4_294_967_296
实值 x 的编码：x_fp = round(x * SCALE)
精度：~9.3 位十进制小数（满足 10^-9 相对误差目标）
```

### 2.2 基本运算

| 运算 | 公式 | 注意 |
| --- | --- | --- |
| 乘法 | `(a * b) >> 32` | 中间用 U256 / u128  widening |
| 除法 | `(a << 32) / b` | b = 0 → revert |
| 加法 / 减法 | 直接 ± | 溢出 → revert |
| 比较 | 整数比较 | — |

### 2.3 常数编码

```rust
// 示例：e ≈ 2.718281828459045
const E_FP: u128 = 11_734_907_089_846_289_754; // round(e * 2^32)

// π, ln(2) 等同理预计算嵌入
```

Solana 使用 `u128` + 手动 widening；Sui 使用 `u128` 或 `u256` 扩展库。**常数 bit 值必须与本 spec 一致。**

### 2.4 容差

| 场景 | 容差 |
| --- | --- |
| 概率输出 P ∈ [0, 1] | `\|P_chain - P_ref\| ≤ 1e-9` |
| 参数 λ, μ, σ | `\|Δ\| ≤ 1e-8`（绝对） |
| 跨链对比 | 允许 **±1 ULP**（Q32.32 最低位） |

---

## 3. 静态查表

### 3.1 阶乘表 `FACTORIAL_LUT`

`FACTORIAL[n] = n!`，n = 0..14，Q32.32 编码：

| n | n! (实值) | 用途 |
| --- | --- | --- |
| 0 | 1 | 泊松、泰勒 |
| 1 | 1 | |
| … | … | |
| 14 | 87,178,291,200 | 上限兜底 |

**链上：** 只读静态数组，长度 15，编译期嵌入。

### 3.2 整数幂 LUT `POW_LUT`

预计算 `λ^k / k!` 的泰勒项分母，或按需 `λ^k` 用快速幂（k ≤ 14，最多 4 次平方）。

**推荐：** 泰勒展开内联计算 `λ^n / n!`，n = 0..8，用 `FACTORIAL_LUT[n]` 作除数。

### 3.3 指数 `exp_neg(λ)` — 预计算 LUT（推荐）

Taylor 8 阶在 λ=8 时误差仍 > 1e-3，**不满足**全区间 $10^{-9}$ 要求。生产环境对 $\lambda \in [0, 8]$ 使用**静态 LUT**：

| 属性 | 值 |
| --- | --- |
| 步长 | 0.01 |
| 格点数 | 801（索引 0..800） |
| 编码 | `EXP_NEG_LUT[i] = round(e^{-i/100} * SCALE)` |
| 查询 | `i = round(λ * 100)`，可选线性插值 |

```rust
fn exp_neg(λ_fp: u128) -> u128 {
  let idx = (λ_fp * 100 / SCALE).clamp(0, 800);
  EXP_NEG_LUT[idx as usize]
}
```

**可选（低 λ 省空间）：** λ ≤ 3 时用 Taylor 14 阶（误差 < 1e-9），λ > 3 走 LUT——两链须择一并在 spec 测试向量中覆盖。

**禁止：** 仅用 8 阶 Taylor 覆盖全区间 [0, 8]。

---

## 4. Poisson 分布

### 4.1 边界

| 参数 | 范围 | 说明 |
| --- | --- | --- |
| `λ` | [0, 8] | 预期进球数；Q32.32 |
| `k` | [0, 14] | 离散结果 |
| `a, b` | 整数区间 | 区间概率 P(a ≤ X ≤ b) |

### 4.2 点质量

$$
P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}
$$

```
poisson_pmf(λ_fp, k: u8) -> u128:
  require k <= 14
  require λ_fp <= LAMBDA_MAX_FP   // 8.0

  pow_k  = pow_lambda(λ_fp, k)    // λ^k
  exp_n  = exp_neg_lut(λ_fp)      // e^(-λ) via LUT
  fact_k = FACTORIAL_LUT[k as usize]

  // P = λ^k * e^(-λ) / k!
  num = (pow_k * exp_n) >> 32
  return (num << 32) / fact_k
```

### 4.3 区间概率

```
poisson_interval(λ_fp, a: u8, b: u8) -> u128:
  require a <= b
  require b <= 14
  sum = 0
  for k in a..=b:
    sum += poisson_pmf(λ_fp, k)
  return min(sum, ONE_FP)
```

### 4.4 尾部概率

```
poisson_tail(λ_fp, k_min: u8) -> u128:   // P(X >= k_min)
  return ONE_FP - poisson_interval(λ_fp, 0, k_min - 1)
```

### 4.5 参数更新（买入「大球」）

用户支付 `amount_usdc`，购买区间 [a, b]。目标：找到新 λ' 使得：

```
poisson_interval(λ', a, b) = target_prob
target_prob = f(amount, pool_state)   // 由 AMM 不变量决定
```

**算法：** 有界二分搜索（max 32 步）或牛顿迭代（max 5 步 + 回退二分）。

```
update_lambda_buy(λ_fp, a, b, delta_prob_fp) -> λ_new_fp:
  target = min(λ_fp_interval(a,b) + delta_prob_fp, ONE_FP)
  λ_new = binary_search_lambda(a, b, target, λ_fp)
  require λ_new <= LAMBDA_MAX_FP
  return λ_new
```

**Newton（可选加速，须 fallback 二分）：**

```
f(λ) = poisson_interval(λ, a, b) - target
f'(λ) ≈ [f(λ+ε) - f(λ-ε)] / (2ε)   // 数值导数，ε = 1e-6
λ ← λ - f/f'，clamp [0, 8]，最多 5 步
```

### 4.6 Max-Loss Bounded Checking

每笔 Poisson 区间买入前，链上计算**单点最坏情景**下总赔付：

```
payout_i = stake * 1e9 / entry_prob_ppb   // 数字期权式
liability(k) = Σ payout_i  for all open positions covering outcome k
require max_k liability(k) ≤ vault + incoming_stake
```

- `liability_by_k` 长度 15（k ∈ [0,14]），每笔成交后累加
- 违反则 revert `MaxLossExceeded`

### 4.7 追加流动性（全局缩放）

**Dirichlet：** $\alpha'_i = \alpha_i \cdot (V_{\text{after}} / V_{\text{before}})$，$p_i$ 不变。

**Poisson：** MVP 阶段追加 USDC **不改变** $\lambda$（仅增厚 Vault / Max-Loss 容量）；浓度参数缩放公式 Phase 2 定稿。

---

## 5. Dirichlet 分布

### 5.1 边界

| 参数 | 范围 |
| --- | --- |
| `α_i` | [α_min, α_max] = [1e-6, 1e12]（Q32.32） |
| 类别数 `K` | [2, 16] |

### 5.2 概率

$$
p_i = \frac{\alpha_i}{\sum_j \alpha_j}
$$

```
dirichlet_prob(alphas: &[u128], i: usize) -> u128:
  sum = alphas.iter().sum()
  require sum > 0
  return (alphas[i] << 32) / sum
```

### 5.3 浓度参数（「波动率」代理）

```
concentration = sum(alphas)
```

- 浓度越高 → 单笔交易对 p_i 冲击越小
- 前端 IV 代理：`vol_proxy = 1 / concentration`

### 5.4 参数更新（买入类别 i）

```
update_dirichlet_buy(alphas, i, stake_fp) -> alphas':
  alphas'[i] = alphas[i] + stake_fp * CONCENTRATION_SCALE
  // stake_fp 与 USDC 数量线性映射，系数由池子 fee 模型决定
  return alphas'
```

**无迭代：** Dirichlet 更新为解析加法，O(K)。

---

## 6. Normal 分布（有界 Tier 1）

### 6.1 边界（创建市场时声明，写入 Pool）

| 参数 | 默认范围 |
| --- | --- |
| `μ` | [μ_min, μ_max] 由 market 配置 |
| `σ` | [σ_min, σ_max]，建议 σ ∈ [0.001, 100] |

### 6.2 CDF — 误差函数泰勒

$$
\Phi(x) = \frac{1}{2}\left(1 + \mathrm{erf}\left(\frac{x-\mu}{\sigma\sqrt{2}}\right)\right)
$$

**erf 近似（Abramowitz & Stegun 7.1.26，或 9 阶泰勒）：**

```
erf(z_fp) -> u128:
  // |z| <= 6 时有效；超出则 ±1
  // 使用 Horner 法多项式，系数见 test-vectors.json constants.erf_coeffs
```

### 6.3 区间概率

```
normal_interval(μ_fp, σ_fp, a_fp, b_fp) -> u128:
  za = (a_fp - μ_fp) / σ_fp / SQRT2_FP
  zb = (b_fp - μ_fp) / σ_fp / SQRT2_FP
  return (erf(zb) - erf(za) + 2*ONE_FP) >> 1   // 归一化到 [0,1]
```

**备选（Gas 更优）：** 预计算 `(μ, σ)` 离散格点 CDF 二维 LUT，创建市场时选定格点密度；Phase 1 先用泰勒，压测后切换。

### 6.4 参数更新

- **方向性（买 [a,b]）：** 增大 μ 向区间中心偏移 + 可选 σ 微调，二分/牛顿同 Poisson。
- **Straddle（买两极）：** 增大 σ，μ 不变；`σ_new = σ + f(stake)` 解析或 1D 搜索。

---

## 7. Beta 分布（有限比例，Phase 1 可选）

| 参数 | 范围 |
| --- | --- |
| `α, β` | [1e-4, 1e6] |
| 支持 x | [0, 1] |

**MVP 简化：** 用 Dirichlet(α, β) 二分类近似，或预计算 `(α, β, x)` 三维 LUT 子集。

完整 Beta CDF 链上实现标记为 **Phase 1.5**，不阻塞 Poisson/Dirichlet/Normal 上线。

---

## 8. 市场类型 → 函数映射

| 市场类型 | 分布 | 定价函数 | 更新函数 |
| --- | --- | --- | --- |
| 足球进球 | Poisson | `poisson_interval` / `poisson_tail` | `update_lambda_buy` |
| 胜平负 | Dirichlet | `dirichlet_prob` | `update_dirichlet_buy` |
| CPI / TPS | Normal | `normal_interval` | `update_normal_mu` / `update_normal_sigma` |
| 得票率 | Beta / Dirichlet | 同上 | 同上 |

---

## 9. 复合事件（MVP）

**独立池 + 联合展示 API（链下 Indexer）：**

```
P(Win AND goals > 2.5) ≈ p_win * poisson_tail(λ, 3)
```

链上**不**实现联合 PDF；前端/Indexer 分别读取两个 Pool 状态后乘法合成，标注「独立假设」。

---

## 10. 链上集成接口

### 10.1 Solana (Rust)

```rust
pub mod math {
    pub fn poisson_pmf(lambda: u128, k: u8) -> Result<u128>;
    pub fn poisson_interval(lambda: u128, a: u8, b: u8) -> Result<u128>;
    pub fn update_lambda_buy(/* ... */) -> Result<u128>;
    pub fn dirichlet_prob(alphas: &[u128], i: usize) -> Result<u128>;
    pub fn normal_interval(mu: u128, sigma: u128, a: u128, b: u128) -> Result<u128>;
}
```

### 10.2 Sui (Move)

```move
module x_market::fixed_point { /* Q32.32 ops */ }
module x_market::poisson { public fun pmf(...): u128 }
module x_market::dirichlet { public fun prob(...): u128 }
module x_market::normal { public fun interval(...): u128 }
```

---

## 11. 测试要求

1. **单元测试：** 每个公开函数覆盖边界、典型、极端值。
2. **跨链一致性：** 同一输入，Solana 与 Sui 输出差 ≤ 1 ULP。
3. **Reference 实现：** `math-spec/reference/` Rust crate，f64 双精度对照。
4. **CI：** 修改 math 模块须跑全量 `test-vectors.json`。

运行 reference 验证（待实现 crate 后）：

```bash
cd math-spec/reference
cargo test
cargo run --bin verify_vectors -- ../test-vectors.json
```

---

## 12. 性能预算

| 操作 | Solana CU 目标 | Sui Gas 目标 |
| --- | --- | --- |
| `exp_neg_lut` 单次 | < 500 | 基准后填 |
| `poisson_pmf` 单次 | < 3,000 | 基准后填 |
| `poisson_interval` (width≤5) | < 12,000 | 基准后填 |
| `update_lambda_buy` | < 80,000 | 基准后填 |
| `dirichlet_prob` (K=3) | < 2,000 | 基准后填 |
| `normal_interval` | < 25,000 | 基准后填 |

超出预算 → 优化 LUT 或减迭代次数（须重新验证精度）。

---

## 13. 文档索引

| 文件 | 说明 |
| --- | --- |
| [SPEC.md](./SPEC.md) | 本规范 |
| [test-vectors.json](./test-vectors.json) | 跨链测试向量 |
| [../PRD.md](../PRD.md) | 产品总纲 |
| [../qa.md](../qa.md) | 技术调研 |

---

*两链独立部署，数学行为必须等价。*
