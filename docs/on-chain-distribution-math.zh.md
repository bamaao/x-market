# 链上分布数学引擎 — Poisson / Dirichlet / Normal / Beta

**版本：** v1.0  
**日期：** 2026-06-16  
**范围：** Sui Move 链上 Tier 1 定价数学  
**相关文档：** [math-spec/SPEC.md](../math-spec/SPEC.md) · [tier2-decision.zh.md](./tier2-decision.zh.md) · [deferred-features.zh.md](./deferred-features.zh.md)

---

## 1. 核心结论

链上**并不直接计算完整的概率密度函数（PDF）**，而是计算**定价所需的概率量**：

| 分布类型 | 链上实际计算 | 用途 |
| --- | --- | --- |
| Poisson（离散） | PMF + 区间求和 | 进球数等离散事件 |
| Dirichlet | 边际概率 \(p_i = \alpha_i / \sum \alpha_j\) | 胜平负、多类别 |
| Normal（连续） | CDF 区间积分 \(\Phi(b) - \Phi(a)\) | CPI、宏观区间 |
| Beta（连续） | 正则化不完全 Beta \(I_x(\alpha,\beta)\) | 投票份额等比例事件 |

复杂超越函数（\(e^{-\lambda}\)、\(\mathrm{erf}\)、不完全 Beta）通过 **Q32.32 定点数 + 有界输入 + 查表 / 级数 / 二分搜索** 的组合在链上实现。

---

## 2. 统一基础设施

### 2.1 Q32.32 定点数

- 链上**禁止浮点**；所有概率输出映射为 `u128`，`1.0` = `2^32` = `4_294_967_296`
- 实现模块：`sources/math/fixed_point.move`
- 精度目标：概率相对误差 ≤ \(10^{-9}\)；跨链对比允许 ±1 ULP

### 2.2 有界输入

所有函数在调用前做边界检查，越界 revert：

| 参数 | 典型范围 |
| --- | --- |
| Poisson \(\lambda\) | [0, 8] |
| Poisson \(k\) | [0, 14] |
| Normal \(\mu, \sigma\) | 按市场配置（如 σ ∈ [0.001, 100]） |
| Beta \(\alpha, \beta\) | [1, 1_000_000] |
| erf 自变量 \(z\) | \|z\| ≥ 6 时饱和为 ±1 |

### 2.3 静态查找表（LUT）

超越函数在**离线**用 Python 脚本预计算，编译期嵌入 Move 模块：

| LUT | 步长 | 网格点数 | 生成脚本 | Move 模块 |
| --- | --- | --- | --- | --- |
| \(e^{-\lambda}\) | 0.01 | 801（λ ∈ [0, 8]） | `math-spec/scripts/gen_exp_neg_lut.py` | `sources/math/exp_neg_lut.move` |
| \(\mathrm{erf}(z)\) | 0.01 | 601（z ∈ [0, 6]） | （自动生成） | `sources/math/erf_lut.move` |

查表方式：`index = round(x * 100)`，直接取整格点值（可选线性插值，当前实现为整格点）。

### 2.4 链下对照与 Preview

- 参考实现（f64）：`math-spec/reference/src/lib.rs`
- 前端 Preview：`pricing-engine/`
- 测试向量：`math-spec/test-vectors.json`
- 链上程序为**唯一真相源**；链下必须与 test vectors bit-exact 对齐

---

## 3. 各分布的处理方式

### 3.1 Poisson — PMF + 区间求和

**公式：**

\[
P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}
\]

**实现模块：** `sources/math/poisson.move`

| 组成部分 | 处理方式 |
| --- | --- |
| \(\lambda^k / k!\) | 循环乘法（k ≤ 14，最多 14 步），不调用 Gamma 函数 |
| \(e^{-\lambda}\) | 801 点静态 LUT（`math_exp_neg_lut::exp_neg_lut`） |
| 区间概率 \(P(a \le X \le b)\) | 对 k = a..b 逐项累加 PMF |
| 参数反解 \(\lambda'\) | 有界二分搜索（最多 32 步，`update_lambda_buy`） |

**关键代码路径：**

```
poisson_pmf → lambda_pow_div_factorial + exp_neg_lut
poisson_interval → 循环累加 poisson_pmf
update_lambda_buy → binary_search_lambda_tenths
```

**设计边界：**

- 足球单队进球极少超过 10，k 上限 14 足够
- λ 严格处于 [0, 8]，使 LUT 网格有限且 Gas 可预测

> **注意：** 早期文档（`docs/qa.zh.md`）曾提到用 Taylor 级数近似 \(e^{-\lambda}\)。当前生产实现与 `math-spec/SPEC.md` 一致，**使用 LUT**。原因：全区间 [0, 8] 仅用 8 阶 Taylor 误差 > \(10^{-3}\)，不满足 \(10^{-9}\) 金融精度要求。Taylor 仅保留在 reference 实现中作 sanity check。

---

### 3.2 Dirichlet — 边际比例（无特殊函数）

**公式：**

\[
p_i = \frac{\alpha_i}{\sum_j \alpha_j}
\]

**实现模块：** `sources/math/dirichlet.move`

Dirichlet 是四类分布中**最简单**的：不需要 Beta 函数、Gamma 函数或任何超越函数。

| 操作 | 复杂度 | 说明 |
| --- | --- | --- |
| 边际概率 | O(K) 一次求和 + 除法 | `dirichlet_prob` |
| 买入更新 | O(1) 解析加法 | `α_i += stake_fp` |
| 追加流动性 | O(K) 比例缩放 | `scale_dirichlet_alphas` |

完整 Dirichlet PDF 含多元 Beta 函数，链上**从不计算**；定价只需边际概率。

---

### 3.3 Normal — CDF 积分（erf 查表）

**定价逻辑：**

\[
P(a \le X \le b) = \Phi(b) - \Phi(a), \quad \Phi(x) = \frac{1}{2}\left(1 + \mathrm{erf}\left(\frac{x-\mu}{\sigma\sqrt{2}}\right)\right)
\]

**实现模块：** `sources/math/normal.move`

| 组成部分 | 处理方式 |
| --- | --- |
| \(\mathrm{erf}(z)\) | 601 点静态 LUT（`math_erf_lut::erf_lut`） |
| \|z\| ≥ 6 | 直接返回 1（饱和） |
| 区间概率 | 两个 CDF 相减 |
| 参数反解 \(\mu'\) | 二分搜索（`update_mu_buy` / `update_mu_buy_tenths`） |
| 负数支持 | `x_negative` 标志位，手动处理有符号差值 |

**参数编码：**

- `normal_interval`：整数 units（如 μ = 250 表示 2.50%）
- `normal_interval_tenths`：十分位（μ = 25 表示 2.5%）

spec 中提到的 2D CDF LUT 备选方案（Phase 1 后按 Gas benchmark 切换）当前未启用，生产路径为 erf LUT + Taylor 注释中的 Abramowitz & Stegun 7.1.26 等价实现。

---

### 3.4 Beta — 正则化不完全 Beta（级数递推）

**定价逻辑：**

\[
P(a \le X \le b) = I_b(\alpha, \beta) - I_a(\alpha, \beta)
\]

其中 \(I_x(\alpha, \beta)\) 为正则化不完全 Beta 函数（即 Beta CDF）。

**实现模块：** `sources/math/beta.move`

这是四类分布中**链上计算最复杂**的一项，已于 2026-06-08 完整实现（见 `docs/deferred-features.zh.md`）。

| 策略 | 说明 |
| --- | --- |
| **不算原始 PDF** | 不直接计算 \(x^{\alpha-1}(1-x)^{\beta-1} / B(\alpha,\beta)\) |
| **二项恒等式** | 整数形状参数 \((\alpha, \beta)\) 下，用二项级数递推求 \(I_x\) |
| **对称变换** | 当 \(\beta > \alpha\) 时，用 \(I_x(\alpha,\beta) = 1 - I_{1-x}(\beta,\alpha)\) 减少项数 |
| **早停** | 级数项 < `TERM_EPS`（≈ \(10^{-9}\) in Q32.32）时终止 |
| **区间编码** | permille（0–1000），如 350–400 = 35%–40% |
| **参数更新** | 按区间中心 vs 均值方向递增 α 或 β（最多 128 步） |

---

## 4. 复杂函数的三层处理策略

```
需要超越函数？
    │
    ├─ 能否有界化？
    │       ├─ 是 → 静态 LUT 查表          （Poisson: e^-λ；Normal: erf）
    │       ├─ 是 → 有界级数/递推 + 早停    （Beta: 不完全 Beta 级数）
    │       └─ 是 → 有界循环乘除            （Poisson: λ^k/k!）
    │
    └─ 无法有界 / 维度过高
            → Tier 2：链下计算 + Attestation / ZK 异步验证
```

| 复杂度 | 策略 | 示例 |
| --- | --- | --- |
| O(1) 查表 | 离线预计算，链上索引 | `exp_neg_lut`（801 点）、`erf_lut`（601 点） |
| O(n) 有界迭代 | 固定上限循环 | Poisson 区间求和、Beta 级数早停 |
| O(log n) 反解 | 二分搜索 | `update_lambda_buy`、`update_mu_buy` |
| O(1) 解析 | 直接加减 | Dirichlet `α_i += stake` |
| Tier 2（未上链） | 链下乐观执行 + 异步监督 | 多维联合 PDF、复杂波动率曲面 |

---

## 5. 市场类型 → 函数映射

| 市场类型 | 分布 | 定价函数 | 参数更新 |
| --- | --- | --- | --- |
| 足球进球 | Poisson | `poisson_interval` / `poisson_tail` | `update_lambda_buy` |
| 胜平负 | Dirichlet | `dirichlet_prob` | `update_dirichlet_buy` |
| CPI / TPS | Normal | `normal_interval` | `update_mu_buy` / `update_normal_sigma` |
| 投票份额 | Beta / Dirichlet | `beta_interval_permille` / `dirichlet_prob` | `update_beta_buy` / `update_dirichlet_buy` |

链上入口：`sources/pool.move`（`buy_poisson_interval`、`buy_dirichlet_outcome`、`buy_normal_interval`、`buy_beta_interval` 等）。

---

## 6. 复合事件（MVP）

链上**不实现联合 PDF**。Indexer / 前端读取多个 Pool 状态，在独立性假设下相乘：

```
P(Win AND goals > 2.5) ≈ p_win × poisson_tail(λ, 3)
```

详见 `math-spec/SPEC.md` §9 与 `docs/tier2-decision.zh.md`。

---

## 7. Tier 1 vs Tier 2 分界

| 层级 | 适用场景 | 计算位置 |
| --- | --- | --- |
| **Tier 1** | 有界单变量 / 低维分布；LUT + 级数可在单交易内完成 | 链上原生定点数 |
| **Tier 2** | 多维联合 PDF；LUT / Taylor 链上算不动 | 链下乐观算价 + Attestation / ZK 冷路径 |

Tier 1 的设计原则（摘自 `math-spec/SPEC.md`）：

1. **有界输入** — 越界 revert
2. **定点数 only** — Q32.32
3. **确定性** — 同输入同输出，跨链 bit-exact
4. **O(1) 优先** — 阶乘 / 低阶幂用查表；Taylor 迭代有固定上限
5. **Oracle 不参与 Tier 1 定价** — 纯链上调用

---

## 8. 源码索引

| 模块 | 路径 |
| --- | --- |
| 定点数 | `sources/math/fixed_point.move` |
| Poisson | `sources/math/poisson.move` |
| Dirichlet | `sources/math/dirichlet.move` |
| Normal | `sources/math/normal.move` |
| Beta | `sources/math/beta.move` |
| e^{-λ} LUT | `sources/math/exp_neg_lut.move` |
| erf LUT | `sources/math/erf_lut.move` |
| 池子交易入口 | `sources/pool.move` |
| 数学规范 | `math-spec/SPEC.md` |
| 参考实现 | `math-spec/reference/src/lib.rs` |
| Preview 引擎 | `pricing-engine/` |
| 单元测试 | `sources/math/*_tests.move` |

---

## 9. 总结

链上"复杂密度函数"的处理哲学：

1. **不算 PDF，算概率** — PMF / CDF 区间 / 边际比例
2. **拆解为简单原子操作** — 乘除、查表、有限求和
3. **利用业务边界** — λ ≤ 8、k ≤ 14、erf 饱和等，控制 Gas 与精度
4. **反解参数用二分搜索** — 固定步数上限，Gas 可预测
5. **真正算不动的留给 Tier 2** — 联合 PDF、高维积分走链下 + 证明 / Attestation 异步监督
