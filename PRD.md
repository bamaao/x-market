# X-Market on Sui — 产品需求文档

> **版本：** v1.4  
> **日期：** 2026-05-25  
> **链：** Sui  
> **状态：** 草案  
> **背景阅读：** [docs/qa.md](./docs/qa.md) · **数学规范：** [math-spec/SPEC.md](./math-spec/SPEC.md)

---

## 1. 项目概述

### 1.1 定位

**X-Market on Sui** 是部署在 Sui 上的独立预测市场，基于参数化 AMM 与概率分布函数（PDF）实现区间定价、期权结构与波动率交易。

与 [X-Market on Solana](../x-market-solana) 为**同级独立项目**：共享产品理念，不共享合约、流动性、用户账户或 API。

### 1.2 一句话

**Sui 上的 PDF 预测市场——对象化头寸，并行定价。**

### 1.3 Sui 选型理由

- 对象模型天然适合 Position 作为独立 Object/NFT
- 按 marketId 分片，多市场并行结算
- 并行执行吞吐高，适合多池并存
- Sui 生态 USDC 与 Supra 预言机逐步成熟

---

## 2. 产品功能

> 功能定义与总纲一致，以下为 Sui 独立实现范围。

### 2.1 分布模板（MVP 起）

| 模板 | 场景 | 链上状态 |
| --- | --- | --- |
| Normal(μ, σ) | CPI、BTC 价格、TPS | `MarketPool` 共享对象 |
| Poisson(λ) | 足球进球、计数事件 | 同上 |
| Dirichlet(α[]) | 胜平负、选举 | 同上 |

### 2.2 合约类型

| 类型 | 优先级 | 说明 |
| --- | --- | --- |
| 数字期权 (Digital) | P0 | PDF 概率定价 |
| 区间合约 (Interval) | P0 | ∫f(x)dx 区间概率 |
| 线性 Call/Put | P1 | max(X−K, 0) |
| Straddle | P1 | 推高 σ |
| Variance Swap | P2 | Phase 3 |

### 2.3 Parametric AMM 行为

- 用户存入 **`Coin<USDC>`**（`MarketPool.vault`），买走赔付承诺
- 交易修改 `MarketPool` 的 μ/σ/λ/α
- **Position 作为 owned object** 归属用户地址，可 transfer（Phase 2 可选）
- **Tier 1（MVP）：** 参数更新与概率计算在 Move 模块内**原子完成**
- **Pricing Engine：** 仅报价预览/SDK，链上为唯一真相源

### 2.4 波动率

- Vol Crush、IV、Vol Smile——详见 [docs/qa.md](./docs/qa.md)；**Sui Indexer 独立**计算与展示

### 2.5 保证金

- 单链 Cross-Margining：同一 Sui 地址下多 Position 统一 VaR
- 不涉及 Solana 或其他链

### 2.6 流动性注入与 LP（Sui 实现）

> 产品逻辑见 [docs/qa.md](./docs/qa.md)（流动性注入、Opening Auction）。

| 能力 | Phase | Sui 实现要点 |
| --- | --- | --- |
| Vault + Prior 创建 | 1 | `create_pool` 扩展：μ/α/λ + USDC 存入 |
| Max-Loss 检查 | 1 | 每笔 `buy_*` 前链上最坏情景赔付 ≤ Vault |
| LP Token + 全局缩放 | 1.5 | `deposit_liquidity`：按 **NAV** 铸 LP 份额 + 等比放大 α（概率不变） |
| NAV 赎回 | 2 | `withdraw_liquidity`：`payout = burn_lp × NAV` |
| $T_2$ 禁入 | 2 | 到期前 N% 时间拒绝 `deposit_liquidity` |
| Opening Auction | 1.5 | `auction_deposit` → `finalize_auction` 原子定标 |
| 市场状态机 | 1.5 | `Auction` → `Trading` → `Settled` |

### 2.7 Opening Auction（Sui）

| 入口（规划） | 说明 |
| --- | --- |
| `start_auction` | 创建市场，竞价期，AMM 未激活 |
| `auction_bid` | USDC 进入胜/平/负（或区间）桶 |
| `finalize_auction` | 截止原子：桶比例 → α₀，Vault 锁定，铸 Position，开启 Trading |
| `buy_poisson_interval` 等 | 仅 `Trading` 状态可调用 |

### 2.8 LP 经济学（产品摘要）

> 完整案例与公式：[docs/qa.md](./docs/qa.md)（皇马 vs 巴萨、选举、CPI、盈亏平衡测算）。

| 概念 | 说明 |
| --- | --- |
| LP 角色 | 承销商；赚滑点、错误预测本金、Theta；亏于逆向选择 |
| 路径积分 | Round-Trip Churn 在概率回归原位时仍沉淀 Vault 溢价 |
| 盈亏平衡 | 净收益 ≈ 交易量 × 滑点率 − 知情套利；示例需 **>500k** USDC 成交量（100k 池、2% 滑点） |
| 运营 | 优先高换手事件；冷门池配合 §2.9 |

### 2.8.1 足球进球区间结算示例（Poisson）

足球总进球是离散整数（0,1,2,3...），系统使用 Poisson 参数 `lambda` 定价区间合约。  
区间合约在结算时遵循二元规则：

- 命中区间：每份头寸按 1 USDC 兑付
- 未命中区间：头寸归零

示例（买入 `[2,6]`）：

- 下单时估计 `lambda = 3.0`
- 区间理论概率（价格）约 `0.65`
- 大额买盘导致参数拨动与滑点后，平均成交价约 `0.70`
- 用户投入 1000 USDC，可获得头寸数量 `1000 / 0.70 = 1428.57`

若最终赛果总进球 `X = 5`：

- 因为 `5 ∈ [2,6]`，结算兑付 = `1428.57 * 1 = 1428.57 USDC`
- 净利润 = `1428.57 - 1000 = +428.57 USDC`
- ROI = `42.857%`

对比：

- 若 `X = 2`：同样命中 `[2,6]`，收益与上例一致
- 若 `X = 1` 或 `X >= 7`：未命中，头寸归零，亏损 1000 USDC

关键点：中间交易过程中的参数更新（`lambda` 变化）影响买入成本和持仓数量；最终清算只看现实结果是否落入购买区间。

### 2.8.2 宽区间（如 `[1,7]`）与 LP 风险画像

“宽区间中奖率高”不等于“对交易者长期有利”。  
原因是区间越宽，入场价格越高，交易者常见的是“高胜率、低赔率”结构。

示例（`lambda = 3.0`）：

- `[1,7]` 理论概率约 95%，价格接近 0.95
- 考虑滑点后平均成本约 0.97
- 投入 1000 USDC，获得 `1000 / 0.97 = 1030.93` 份头寸

两种结局：

- 常态（约 95%）：命中后总兑付 1030.93，净赚 30.93（ROI 约 3.09%）
- 尾部（约 5%）：未命中则头寸归零，单次亏损 1000

这类仓位的本质是“高频小赚 + 低频大亏”。  
对 LP 来说，对应的是“高频小赔 + 低频大赚”，最终长期盈亏取决于：

- 滑点与费率带来的溢价
- 事件池的交易换手率
- 尾部结果出现频率
- 风险参数（见 §2.9）对逆向选择的抑制效果

### 2.9 LP 工程防守（Sui 实现）

> 总纲 [PRD §4.8](../x-market/PRD.md) · 调研 [docs/qa.md](./docs/qa.md)「顶级工程防守」。

| 机制 | Phase | Sui 实现要点 |
| --- | --- | --- |
| **动态费率引擎** | 2 | `MarketPool` 字段 `fee_multiplier_bps`；链下 Indexer 或链上滑动窗口检测 → entry 更新费率 |
| **虚拟流动性 / σ 防守** | 2 | `sigma_virtual` / 浓度加成；随 vault 余额或累计成交量衰减 |
| **结算时间锁** | 2 | `paused` + `resolution_window_ts`；到期禁 `buy_*` |
| Max-Loss（已有） | 1 | `risk.move` |
| Opening Auction（已有） | 1.5 | `pool.move` 竞价流程 |

建议模块：`sources/lp_guard.move`。

### 2.10 LP 收益与 NAV（Sui 实现）

> 总纲 [PRD §4.9](../x-market/PRD.md) · 调研 [docs/qa.md](./docs/qa.md)「LP 的收益呢？特别是 LP 加入时机不一样」。

**NAV 公式：**

$$\text{NAV} = \frac{\text{vault USDC 余额} - L_{\text{mtm}}}{\text{lp\_shares}}$$

| 符号 | `MarketPool` 字段 / 模块 |
| --- | --- |
| $V_{\text{cash}}$ | `vault` `Balance<USDC>` |
| $L_{\text{mtm}}$ | Phase 1.5：`max_k liability_by_k`；Phase 2：全 Position MTM |
| $S_{\text{lp}}$ | `lp_shares` |

| 入口 | Phase | 行为 |
| --- | --- | --- |
| `deposit_liquidity` | 1.5 | `nav_pre` → `mint_lp = amount / nav_pre` → 入 vault → 全局缩放 α |
| `withdraw_liquidity` | 2 | `payout = burn × nav_pre` |
| — | 2 | 到期前 N% 禁 `deposit`（$T_2$） |

**加入时机：** 与 Solana 侧 §2.10 产品表一致（$T_0$/$T_1$/$T_2$）。

**当前实现差距：** `deposit_liquidity` 暂为 1:1 累加 `lp_shares`，Phase 1.5 对齐 NAV。

---

## 3. 技术架构

### 3.1 项目结构（建议）

```
x-market-sui/
├── packages/
│   └── x_market/
│       ├── market_pool.move
│       ├── position.move
│       ├── settlement.move
│       └── math/                  # Tier 1 链上数学引擎
│           ├── poisson.move
│           ├── dirichlet.move
│           ├── normal.move
│           └── fixed_point.move
├── pricing-engine/        # 链下镜像（预览/SDK）
├── indexer/
├── app/
├── sdk/
└── tests/
    └── math/
```

### 3.2 架构图

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web App    │  │  Quant SDK  │  │  Admin      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └──────────────┼────────────────┘
                      │
         ┌────────────▼────────────┐
         │   Sui Indexer / GraphQL │
         └────────────┬────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼───┐    ┌────────▼────────────────────────┐   ┌────▼────┐
│Preview│    │ Move Modules                      │   │ Oracle  │
│Engine │    │ ┌─────────────────────────────┐   │   │ 仅结算  │
│(可选) │    │ │ Tier 1 Math Engine (链上)   │   │   │ Supra   │
└───────┘    │ │ Poisson·Dirichlet·Normal    │   │   │ Pyth    │
             │ └─────────────────────────────┘   │   └─────────┘
             │ MarketPool · Position (owned)       │
             └───────────────────────────────────┘
                          │
             Phase 3: ZK Coprocessor (Tier 2 异步验证)
```

### 3.3 智能合约（Move）

| 对象 | 能力 | 说明 |
| --- | --- | --- |
| `MarketPool` | `key`, shared | 分布参数、USDC 余额、到期 |
| `Position` | `key`, owned | 用户头寸，对象化 NFT |
| `GlobalConfig` | `key`, shared | 费率、AdminCap |

**Tier 1 链上数学引擎（MVP 核心）：**

| 模块 | 实现 | 边界 |
| --- | --- | --- |
| `poisson.move` | 阶乘 LUT + `EXP_NEG_LUT[801]` | λ ∈ [0, 8] |
| `dirichlet.move` | α 向量运算 + 归一化 | α ≥ ε |
| `normal.move` | erf 泰勒或 CDF LUT | μ、σ 有界 |
| `fixed_point.move` | Move 定点数（U128 缩放） | 精度 $10^{-9}$ |

**Sui 特有能力：**

- Position 作为 owned object，用户钱包直接持有
- 不同 MarketPool 无写冲突，并行交易
- 动态字段扩展元数据

**参数更新：** 同一 PTB（Programmable Transaction Block）内完成算价 + 更新 + 写状态。

**Tier 2（Phase 3）：** ZK Coprocessor 异步验证，不阻塞交易。

### 3.4 链下服务

| 服务 | 职责 | 是否关键路径 |
| --- | --- | --- |
| **Preview Engine** | 镜像链上数学，前端报价 | ❌ |
| **Indexer** | 事件索引、IV 展示 | ❌ |
| **Oracle Relayer** | **仅**到期结算 | 仅结算时 |

### 3.5 预言机（仅结算，不参与定价）

| 数据类型 | 方案 | 用途 |
| --- | --- | --- |
| 链上数值 | Pyth (Sui) / Supra | 到期结算 |
| 宏观 | 多签 + 挑战期 | 到期结算 |
| 体育 | Optimistic Oracle | 到期结算 |

> ⚠️ 禁止 Oracle 签名更新 λ/μ/σ。

### 3.6 链上/链下分工

| 操作 | Tier | 链上 | 链下 |
| --- | --- | --- | --- |
| Poisson / Dirichlet 定价 | 1 | ✅ 原子 | 镜像预览 |
| Normal CDF（有界） | 1 | ✅ 原子 | 镜像预览 |
| 参数更新 | 1 | ✅ 原子 | ❌ |
| USDC 存取 / 结算 | — | ✅ | |
| IV 曲面 | — | | ✅ Indexer |
| 多维 PDF | 2 | 乐观执行 ✅ | ZK 异步验证 |

---

## 4. 前端（Sui 专用）

### 4.1 核心页面

- 市场列表 / 详情 / 交易面板
- PDF 曲线 + 区间选择
- IV 面板
- 持仓（Sui 地址 + Position 对象列表）
- 创建市场

### 4.2 钱包

- Sui Wallet、Slush、OKX Wallet (Sui)
- 仅连接 Sui RPC，无链切换

### 4.3 Sui 特色交互

- Position 对象在钱包中可见（类 NFT 展示）
- 多 Market 并行下单无 nonce 竞争

---

## 5. 非功能需求

| 类别 | 指标 |
| --- | --- |
| 链上确认 | < 1s（Sui 典型） |
| 报价延迟 | < 200ms |
| API uptime | 99.9% |
| 安全 | Move 专项审计 |
| 合规 | GeoBlock、非托管 |

---

## 6. 里程碑

### Phase 0（Week 1–4）

- [x] Move 包初始化、MarketPool 骨架
- [x] **Tier 1 链上数学引擎 PoC**：`poisson.move` + `dirichlet.move`
- [x] Gas 基准：单笔 Poisson 区间买入（目标可接受范围内）
- [x] Testnet 部署 + math 测试向量

### Phase 1 — MVP（Week 5–12）

- [x] Tier 1 全模板：Poisson / Dirichlet / Normal（有界）
- [x] 数字期权 + 区间合约（链上原子）
- [x] USDC Vault + **Max-Loss Bounded Checking**
- [x] **结算专用** Oracle（不参与 Prior）
- [x] Next.js 前端
- [x] 3 个 Testnet 种子市场

### Phase 1.5 — 冷启动与 LP（Week 12–14）

- [x] **Opening Auction**：`start_auction` / `auction_bid` / `finalize_auction`
- [x] **NAV 申购**：`deposit_liquidity` 按 `nav_pre` 铸 `lp_shares` + 全局等比缩放 α
- [x] 市场状态机 `Auction` → `Trading`

### Phase 2（Week 13–20）

- [x] 线性期权、Straddle
- [x] IV 面板
- [x] Cross-Margin
- [x] **LP 防守：** 动态费率 + 虚拟 σ/浓度 + 结算时间锁（`lp_guard.move`）
- [x] **NAV 赎回**：`withdraw_liquidity`；$T_2$ 末期禁申购
- [x] Normal CDF 精度压测

### Phase 3（Week 21–28）

- [x] Tier 2 ZK Coprocessor（接口与对象流已实现）
- [x] Variance Swap、结构化票据（Structured / Range / Barrier）
- [ ] Slash + 审计 + 主网（Slash 已实现；审计与主网发布待完成）

---

## 7. KPI

| 阶段 | 指标 | 目标 |
| --- | --- | --- |
| MVP | 种子市场 | ≥ 3 |
| MVP | 周活交易者 | ≥ 500 |
| MVP | TVL (Sui) | ≥ $500K |
| Phase 2 | SDK 接入 | ≥ 3 |
| Phase 3 | 机构 AUM | ≥ $5M |

---

## 8. 风险

| 风险 | 应对 |
| --- | --- |
| Move 数值精度 | Tier 1 定点数 + math-spec 测试向量 |
| Oracle 抢跑 | Oracle 仅结算，不参与定价 |
| LP 逆向选择 / 肉鸡化 | Max-Loss + Opening Auction + **Phase 2 三套 LP 防守**（§2.9） |
| Gas 偏高 | 有界近似 + 静态 LUT |
| Sui 生态 TVL | 独立运营；优先高换手种子市场 |
| Tier 2 延迟 | ZK 异步，不阻塞交易 |

---

## 9. 开放问题

1. Move 定点数库选型：自建 vs 社区 `fixed_point32` -> **已解决**：选择了自建 `math_fixed_point.move`（U128 缩放，精度 $10^{-9}$），为了避免引入不必要的外部依赖，并精确适配概率引擎（泰勒展开、LUT）的数值边界。
2. Normal CDF 方案：math-spec 对齐后压测 Gas -> **已解决**：采用了有界 erf 多项式近似（`math_normal.move`）。在 Sui Testnet 实测执行单笔期权买入交易 Gas 消耗极低且高度平稳，验证了纯链上计算 CDF 的工程可行性。
3. Position 是否允许 secondary transfer -> **已解决**：已移除对象内部的冗余 `owner` 字段，现在完全依靠 Sui 原生所有权机制，支持通过原生 `sui client transfer` 或 PTB 无缝实现二级市场转让。
4. Tier 2 ZK：Axiom vs Brevis -> **已决议**：Phase 3 优先接入 **Brevis**。Brevis 在 Sui 生态（及 Move 架构）上支持度更高，能完美契合结构化票据对链上历史状态证明与异步密集计算的需求。
5. Normal/Poisson 追加 LP 浓度参数公式 -> **已解决**：采用**资金比例缩放（Proportional Scaling）**。Dirichlet 在申购时按新旧 Vault 比例等比放大 $\alpha$；Normal/Poisson 则通过 `nav` 及代币发行量折算，保持分布参数无损。
6. Opening Auction 尾盘操纵缓解：TWAP / 冻结 / 单笔上限 -> **已解决（策略敲定）**：实施**时间冻结（Time Freeze）+ 单笔硬顶**机制。在竞价截止前的一段窗口内禁止大额新增 Bid，且限制单笔注资占比，防止抢跑巨鲸在最后一秒篡改开盘概率。
7. **动态费率与虚拟流动性：** 检测窗口、衰减曲线（见 docs/qa.md §LP 防守） -> **已解决**：采用**链下观测 + 链上更新**的混合 PID 控制方案。Indexer 实时监测近期交易量 EMA 与偏度风险，调用 `set_lp_guard_params` 来动态拉高费率乘数和虚拟波动率 $\sigma$，并在风险褪去后平滑衰减，省去了高昂的链上时间加权计算。

---

*独立 Sui 市场，独立流动性，独立生态。*
