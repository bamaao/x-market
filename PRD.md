# X-Market on Sui — 产品需求文档

> **版本：** v1.8  
> **日期：** 2026-06-05  
> **链：** Sui  
> **状态：** 草案  
> **背景阅读：** [docs/qa.md](./docs/qa.md) · **数学规范：** [math-spec/SPEC.md](./math-spec/SPEC.md) · **预言机操作手册：** [docs/oracle-playbook.md](./docs/oracle-playbook.md) · **知识付费生态：** [SuiProphet_Network.md](./SuiProphet_Network.md)

---

## 1. 项目概述

### 1.1 定位

**X-Market on Sui** 是 Sui 上预测市场**产品体系**的链上实现载体：底层共享**统一全链事件中心（Unified Event Engine / Oracle）**，上层挂载两类可组合业务模块——

| 模块 | 产品名 | 核心行为 |
| --- | --- | --- |
| **博弈模块** | X-Market | 参数化 AMM + PDF 定价；用户买入 `Position` 承担赔付博弈 |
| **付费模块** | SuiProphet Network | 预言家发布私密分析；订阅者付费解锁；事后全链审计战绩 |

二者共用同一**市场根对象（`EventRoot`）**：同一现实世界事件、同一 `lock_time`、同一 Oracle 结算结果，避免「带单」与「下注」数据割裂。

### 1.2 一句话

**万物皆对象：一个事件根节点，博弈与知识付费并行生长。**

### 1.3 Sui 选型理由

- **万物皆对象：** 事件、头寸、私密预测均可建模为 Object / Child Object
- **动态字段：** `EventRoot` 通过 Dynamic Fields 挂载 AMM 池与 Prophet 注册表，模块解耦、根节点统一
- 按 `event_id` 分片，多市场并行结算与并行解锁
- 并行执行吞吐高，适合多池 + 多预言家并存
- Mysten 原生栈：Sui + Walrus + Seal + USDC

### 1.4 产品体系与三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  应用层：Web App · Prophet 主页 · 排行榜 · Gas Station        │
├─────────────────────────────────────────────────────────────┤
│  业务模块层                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────┐   │
│  │ X-Market 博弈模块    │    │ SuiProphet 付费模块      │   │
│  │ MarketPool · Position│    │ PrivateProphecy · 战绩   │   │
│  └──────────┬──────────┘    └────────────┬────────────┘   │
│             └──────────────┬───────────────┘                 │
│                            ▼                               │
│              EventRoot（市场根对象 · shared）                 │
│         lock_time · oracle_feed_id · event_status          │
├─────────────────────────────────────────────────────────────┤
│  统一全链事件中心（Unified Event Engine / Oracle）           │
│  macro_oracle · oracle_arbitrator · DataFeed · 委员会终裁    │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 职责 | 共享与否 |
| --- | --- | --- |
| **L0 事件中心** | 注册指标、乐观提议、争议、委员会终裁、固化 `resolved_value` | 全产品唯一真相源 |
| **L1 市场根** | 绑定现实世界事件元数据；指向 L0 Feed；管理生命周期 | 博弈 + 付费共用 |
| **L2 业务模块** | AMM 定价/头寸，或 Seal+Walrus 私密预测/解锁 | 可独立启用或叠加 |

> **当前实现（Testnet）：** L2 博弈模块已落地（`MarketPool` 即事实上的市场根）；L0 Oracle 已落地（§10）；L2 SuiProphet 核心链上模块已落地（`prophet_registry` / `prophet_leaderboard`，§11）；L1 `EventRoot` 显式抽象仍为 **Phase 4 待办**（见 §6）。

---

## 2. 产品功能（X-Market 博弈模块）

> 本章为 **L2 博弈模块**功能范围，挂载于 `EventRoot`（§3.7）。**L2 付费模块**见 [§11 SuiProphet Network](#11-suiprophet-network知识付费模块)。

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

> 调研 [docs/qa.md](./docs/qa.md)「顶级工程防守」。

| 机制 | Phase | Sui 实现要点 |
| --- | --- | --- |
| **动态费率引擎** | 2 | `MarketPool` 字段 `fee_multiplier_bps`；链下 Indexer 或链上滑动窗口检测 → entry 更新费率 |
| **虚拟流动性 / σ 防守** | 2 | `sigma_virtual` / 浓度加成；随 vault 余额或累计成交量衰减 |
| **结算时间锁** | 2 | `paused` + `resolution_window_ts`；到期禁 `buy_*` |
| Max-Loss（已有） | 1 | `risk.move` |
| Opening Auction（已有） | 1.5 | `pool.move` 竞价流程 |

建议模块：`sources/lp_guard.move`。

### 2.10 LP 收益与 NAV（Sui 实现）

> 调研 [docs/qa.md](./docs/qa.md)「LP 的收益呢？特别是 LP 加入时机不一样」。

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

**加入时机：** $T_0$ 开盘拓荒、$T_1$ 中场溢价扩容、$T_2$ 末期禁入（封盘前 N% 拒绝 `deposit_liquidity`）；详见 [docs/qa.md](./docs/qa.md)。

**当前实现差距：** `deposit_liquidity` 暂为 1:1 累加 `lp_shares`，Phase 1.5 对齐 NAV。

---

## 3. 技术架构

### 3.0 统一全链事件中心（Unified Event Engine）

事件中心是产品体系**唯一结算真相源**，与业务模块（AMM / 知识付费）解耦：

| 能力 | 模块 | 说明 |
| --- | --- | --- |
| Feed 自动注册 | `pool::create_*_with_feed` / `register_data_feed_for_pool` | 建市场同一 PTB；`FeedRegistry` 索引 |
| Feed 链上发现 | `lookup_feed_by_market` / Indexer 扫 `market_id` | 前端无需 `ORACLE_FEED_*` env |
| 乐观提议 | `propose_data` | 任何人搬运官方/赛果数据 |
| 争议立案 | `dispute_and_request_arbitration` | 同一 PTB 创建 `ArbitrationCase` |
| 委员会终裁 | `oracle_arbitrator` | 多签委员；**非 Admin 单方** |
| 结果消费 | `get_finalized_value` / `set_resolution` | 博弈 `claim`、Prophet 审计共用 |

**原则：**

1. Oracle **仅结算**，禁止参与 AMM 的 λ/μ/σ 定价（§3.5）。  
2. 同一 `DataFeed` 固化后，挂载于同一 `EventRoot` 的所有模块读取**同一** `resolved_value`。  
3. 委员终裁、质押博弈详见 [§10](#10-宏观经济数据预言机macro-data-oracle)。

```
现实世界事件发布
       │
       ▼
  macro_oracle（L0）
  propose → liveness → [dispute → committee] → Finalized
       │
       ├─► MarketPool.set_resolution  → Position.claim（博弈）
       └─► ProphetRegistry.audit      → Leaderboard（付费）  [Phase 4]
```

### 3.1 项目结构（建议）

```
x-market-sui/
├── packages/
│   └── x_market/
│       ├── market_pool.move
│       ├── position.move
│       ├── settlement.move
│       ├── macro_oracle.move    # 宏观数据乐观预言机
│       ├── oracle_arbitrator.move  # 委员会终裁（可插拔）
│       ├── settlement_oracle.move
│       ├── event_root.move        # 市场根对象（Phase 4）
│       ├── prophet_registry.move  # SuiProphet 付费/审计（Phase 4）
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
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ X-Market App │  │ Prophet 主页  │  │ Quant SDK    │  │ Gas Station  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       └─────────────────┼──────────────────┴─────────────────┘
                         │
            ┌────────────▼────────────┐
            │  Sui Indexer / GraphQL  │
            └────────────┬────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────▼────┐     ┌─────────▼──────────────────────────┐    ┌─────▼─────┐
│ Walrus  │     │         Move Modules (Sui)          │    │   Seal    │
│ Blob    │     │  ┌──────────────────────────────┐  │    │ 条件解密   │
└─────────┘     │  │ L0 Unified Event Engine       │  │    └───────────┘
                │  │ macro_oracle · oracle_arbitrator│  │
                │  └──────────────┬───────────────┘  │
                │                 │                   │
                │  ┌──────────────▼───────────────┐  │
                │  │ L1 EventRoot (shared)         │  │
                │  │ lock_time · feed_id · status  │  │
                │  └───┬──────────────────┬───────┘  │
                │      │ Dynamic Field    │ Child Obj │
                │  ┌───▼──────────┐  ┌───▼──────────┐ │
                │  │ L2 AMM 博弈   │  │ L2 Prophet   │ │
                │  │ MarketPool    │  │ PrivateProphecy│ │
                │  │ Position      │  │ paid_buyers  │ │
                │  └──────────────┘  └──────────────┘ │
                └─────────────────────────────────────┘
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
- 不同 EventRoot / MarketPool 无写冲突，并行交易
- Dynamic Fields 挂载模块扩展；Child Objects 承载私密预测

### 3.7 市场根对象（EventRoot）与模块挂载

在 Sui 上，一个预测市场拆解为**一个共享根对象** `EventRoot`，博弈与付费模块通过 Dynamic Fields 或 Child Objects 共用该根节点：

```move
/// 目标模型（Phase 4）— 当前 Testnet 以 MarketPool + DataFeed.market_id 过渡
public struct EventRoot has key {
    id: UID,
    event_id: vector<u8>,       // 全局事件标识，对齐 DataFeed.identifier
    lock_time: u64,             // 事件截止；Seal 条件 B、停止付费写入
    oracle_feed_id: ID,         // 指向 macro_oracle::DataFeed
    status: u8,                 // Open · Trading · Locked · Settled · Nullified
    // 动态字段（不膨胀根对象体积）：
    //   b"amm"            -> AMMExtension { pool_id, distribution_kind }
    //   b"prophet_registry" -> ProphetRegistry { treasury, protocol_fee_bps }
}
```

| 挂载方式 | 对象 | 模块 | 读写特征 |
| --- | --- | --- | --- |
| **Dynamic Field** `b"amm"` | `AMMExtension` → `MarketPool` ID | X-Market 博弈 | 高频交易写 `MarketPool`；根对象只读引用 |
| **Dynamic Field** `b"prophet_registry"` | `ProphetRegistry` | SuiProphet | 解锁费入金库；`paid_buyers` 在子对象 |
| **Child Object** | `PrivateProphecy` | SuiProphet | 预言家 owned → 结算后转 Public；含 `blob_id`、`plaintext_hash` |
| **Child Object** | `Position` | X-Market | 交易者 owned NFT 头寸 |

**结算联动（单一 Oracle 输出）：**

1. L0 `DataFeed` → `Finalized`，写入 `resolved_value`。  
2. L1 `EventRoot.status` → `Settled`。  
3. L2 博弈：`MarketPool::set_resolution` → `settlement::claim_position`。  
4. L2 付费：Keeper 触发 Prophet 审计（§11.4）→ Hash 校验 → 战绩更新 → Seal 条件 B 公开解密。

**参数更新：** 同一 PTB 内完成算价 + 更新 + 写状态。

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
| 宏观（CPI、GDP 等） | **Macro Data Oracle**（乐观博弈 + 挑战期 + 可插拔仲裁） | 到期结算 |
| 体育 | Optimistic Oracle | 到期结算 |

> ⚠️ 禁止 Oracle 签名更新 λ/μ/σ。  
> **宏观数据完整规范：** 见 [§10 宏观经济数据预言机](#10-宏观经济数据预言机macro-data-oracle)。

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

**X-Market 博弈：**

- 市场列表 / 详情 / 交易面板
- PDF 曲线 + 区间选择
- IV 面板
- 持仓（Sui 地址 + Position 对象列表）
- Oracle 结算面板（`/oracle`）
- 创建市场

**SuiProphet 付费（Phase 4）：**

- 预言家主页 / 发布私密预测
- 全链排行榜（Prophet Score）
- 付费解锁（仅 USDC，Gas Station 代付）

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

- [x] Tier 2 ZK Coprocessor（接口 + challenge period + 延迟 finalization）
- [x] Variance Swap、结构化票据（Structured / Range / Barrier）
- [x] Slash 治理增强（timelock + 单次/周期限额 + 多签执行通道）
- [x] 安全修复批次（`u64->u8` 窄化防护、结算值边界校验、Cross-Margin 全局仓位锁）
- [ ] 外部审计报告收敛 + 主网发布（进行中）

### Phase 4 — SuiProphet & EventRoot（Week 29–40）

- [ ] **`EventRoot` 显式抽象**：从 `MarketPool` 迁移/包装为动态字段挂载模式
- [x] **`prophet_registry` 模块**：私密预测 Commit、`paid_buyers`、解锁分账、Hash 审计
- [x] **`prophet_leaderboard` 模块**：Prophet Score 公式与战绩统计
- [ ] **Walrus + Seal 集成**：门限加密上传；双重 OR 访问策略（付费 / 到期公开）
- [ ] **事后审计流**：`Hash(plaintext) == chain_commit` → 战绩胜/负 → Leaderboard
- [ ] **Prophet Score 排行榜**：$w_1 \cdot \text{Accuracy} + w_2 \cdot \log(N) + w_3 \cdot \text{ROI}$
- [ ] **Gas Station**：赞助交易；用户仅见 USDC 变动
- [ ] **时间窗口保护**：`lock_time` 前 5 分钟关闭付费通道

---

## 7. KPI

| 阶段 | 指标 | 目标 |
| --- | --- | --- |
| MVP | 种子市场 | ≥ 3 |
| MVP | 周活交易者 | ≥ 500 |
| MVP | TVL (Sui) | ≥ $500K |
| Phase 2 | SDK 接入 | ≥ 3 |
| Phase 3 | 机构 AUM | ≥ $5M |
| Phase 4 | 注册预言家 | ≥ 100 |
| Phase 4 | 付费解锁 GMV | ≥ $50K / 月 |

---

## 8. 风险

| 风险 | 应对 |
| --- | --- |
| Move 数值精度 | Tier 1 定点数 + math-spec 测试向量 |
| Oracle 抢跑 | Oracle 仅结算，不参与定价 |
| 宏观数据造假 / 修正案 | Macro Data Oracle 质押博弈 + 争议窗口 + 可插拔仲裁（§10） |
| LP 逆向选择 / 肉鸡化 | Max-Loss + Opening Auction + **Phase 2 三套 LP 防守**（§2.9） |
| Gas 偏高 | 有界近似 + 静态 LUT |
| Sui 生态 TVL | 独立运营；优先高换手种子市场 |
| Tier 2 延迟 | ZK 异步，不阻塞交易 |
| 私密预测作弊 | 链上锁死 `plaintext_hash`；结算时合约内 Hash 校验 |
| Seal/Walrus 可用性 | 条件 B（到期公开）兜底；Indexer 缓存公开明文 |
| 临近截止套利 | `lock_time - 5min` 关闭 `paid_buyers` 写入 |

---

## 9. 开放问题

1. Move 定点数库选型：自建 vs 社区 `fixed_point32` -> **已解决**：选择了自建 `math_fixed_point.move`（U128 缩放，精度 $10^{-9}$），为了避免引入不必要的外部依赖，并精确适配概率引擎（泰勒展开、LUT）的数值边界。
2. Normal CDF 方案：math-spec 对齐后压测 Gas -> **已解决**：采用了有界 erf 多项式近似（`math_normal.move`）。在 Sui Testnet 实测执行单笔期权买入交易 Gas 消耗极低且高度平稳，验证了纯链上计算 CDF 的工程可行性。
3. Position 是否允许 secondary transfer -> **已解决**：已移除对象内部的冗余 `owner` 字段，现在完全依靠 Sui 原生所有权机制，支持通过原生 `sui client transfer` 或 PTB 无缝实现二级市场转让。
4. Tier 2 ZK：Axiom vs Brevis -> **已决议**：Phase 3 优先接入 **Brevis**。Brevis 在 Sui 生态（及 Move 架构）上支持度更高，能完美契合结构化票据对链上历史状态证明与异步密集计算的需求。
5. Normal/Poisson 追加 LP 浓度参数公式 -> **已解决**：采用**资金比例缩放（Proportional Scaling）**。Dirichlet 在申购时按新旧 Vault 比例等比放大 $\alpha$；Normal/Poisson 则通过 `nav` 及代币发行量折算，保持分布参数无损。
6. Opening Auction 尾盘操纵缓解：TWAP / 冻结 / 单笔上限 -> **已解决（策略敲定）**：实施**时间冻结（Time Freeze）+ 单笔硬顶**机制。在竞价截止前的一段窗口内禁止大额新增 Bid，且限制单笔注资占比，防止抢跑巨鲸在最后一秒篡改开盘概率。
7. **动态费率与虚拟流动性：** 检测窗口、衰减曲线（见 docs/qa.md §LP 防守） -> **已解决**：采用**链下观测 + 链上更新**的混合 PID 控制方案。Indexer 实时监测近期交易量 EMA 与偏度风险，调用 `set_lp_guard_params` 来动态拉高费率乘数和虚拟波动率 $\sigma$，并在风险褪去后平滑衰减，省去了高昂的链上时间加权计算。
8. **MarketPool 与 EventRoot 关系：** 是否重构为显式根对象？ -> **已决议（Phase 4）**：引入 `EventRoot` 共享对象，`MarketPool` 降级为 Dynamic Field `b"amm"` 扩展；现有 Testnet 池通过 `DataFeed.market_id` 与 L0 Oracle 已联通，迁移采用包装而非硬分叉。

---

## 10. 宏观经济数据预言机（Macro Data Oracle）

### 10.0 定位说明

**宏观数据源预言机（Macro Data Oracle）** 的核心任务是：为链上生态提供真实、不可篡改的宏观经济指标（如 GDP、CPI 等）。它**不需要**预测市场式的 Commitment / 下注阶段，角色是链上的「数据搬运工与公证处」——供 DeFi、保险、**预测市场结算**等智能合约只读消费。

本节术语统一采用预言机语义（`dataIdentifier`、`proposedResult`、`assertionId`），避免混用预测市场词汇（如 `marketId`、`proposeOutcome`）。

### 10.1 概述

| 项 | 说明 |
| --- | --- |
| **产品定位** | 基于乐观博弈（Optimistic Oracle）的链上宏观/财务数据源 |
| **核心目标** | 允许任何链下节点将官方发布的宏观数据搬运上链；通过质押与挑战确保真实性；固化后开放给全网合约调用 |
| **闭环四阶段** | 提议 → 挑战 → **仲裁** → 清算（缺一不可；无仲裁则经济博弈无法闭合） |

### 10.2 系统核心业务流程

数据上链生命周期由现实世界的发布节点与链上时间窗口驱动：

```
事件发生 → 提议结果 → 争议窗口 → [可选] 仲裁 → 最终结算与消费
```

1. **事件发生 (Event Occurrence)**  
   官方机构（如美国劳工统计局 BLS、各国统计局）在约定时间点正式发布宏观指标。

2. **提议结果 (Propose Result)**  
   链下节点（Proposer）读取官方数据，调用合约写入明文结果（如 `CPI = 2.8%`），并**质押 Proposer Bond**。

3. **争议窗口 (Dispute Window)**  
   进入倒计时（典型 24 小时）。全网观察者对照官方源交叉校验。  
   - **无人反对**：倒计时结束 → 无争议 finalize → 数据固化。  
   - **发现造假/错误**：挑战者质押 **Disputer Bond** → 状态进入 **In_Arbitration** → 移交外部仲裁层（UMA DVM、多签/DAO 委员会等）。

4. **最终结算与消费 (Final Settlement & Egress)**  
   - 无争议 finalize 或仲裁完毕后：状态 → `Finalized`。  
   - 胜诉方赎回押金并获得奖励；败诉方押金按规则罚没。  
   - 外部合约通过只读接口安全读取已固化数据。

> **仲裁延迟说明：** 链下仲裁（如 UMA DVM 投票）通常需 2–3 天取证与投票。处于 `In_Arbitration` 期间数据不可消费；下游合约须对 `revert` 做异步/重试处理。

### 10.3 功能需求详情

#### 10.3.1 宏观指标定义与注册（Data Identifier Registry）

为防止对同一指标理解歧义，链上须对每条宏观数据进行标准化注册。

**自动注册 + 链上发现（产品路径，v1.8+）：**

| 路径 | 调用方 | 说明 |
| --- | --- | --- |
| **建市场即注册** | 市场创建者 | `create_poisson_pool_with_feed` 等：同一 PTB 内 `share_pool` 前写入 `DataFeed` |
| **创建者补登** | `MarketPool.authority` | 旧池或未走 `_with_feed` 时：`register_data_feed_for_pool` |
| **治理覆盖** | Admin | `register_data_feed`（迁移/异常修复） |
| **发现** | 前端 / Indexer | `FeedRegistry` 按 `market_id` 查 `DataFeed`；禁止每市场写 `.env` |

`create_oracle_config` 同时创建共享对象 **`FeedRegistry`**（`market_id` → `feed_id` 动态字段），并记录在 `OracleConfig.feed_registry_id`。

**注册要素：**

| 字段 | 说明 |
| --- | --- |
| `Data_Identifier` | 唯一标识（例：`US_CPI_2026_M05`） |
| `Ancillary_Data` | 权威 URL（如 `bls.gov`）、精确定义（如「未季调 CPI 年率」）、**初值原则**（见 §10.4.1） |
| `Liveness_Period` | 争议窗口时长（秒） |
| `Bond_Required` | 提议/挑战最低押金（可与 TVL 挂钩，见 §10.4.2） |
| `Event_Ts` | 官方数据可提议的最早链上时间（通常 ≥ 关联合约/市场的 maturity） |
| `Linked_Consumer` | 可选：绑定的消费方对象 ID（如 X-Market `MarketPool`） |

#### 10.3.2 提议与争议机制（The Optimistic Engine）

乐观预言机的经济学引擎：通过质押博弈使链下真实数据暂存于链上。

**数据提议 (Data Proposal)**

| 项 | 内容 |
| --- | --- |
| **功能** | 宏观事件发生后，Proposer 将官方数据明文搬运上链 |
| **接口** | `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)` |
| **前提** | 转入 ≥ `Proposer_Bond_Size` 的系统本位币（如 USDC）；`dataIdentifier` 处于可提议状态（见 §10.5 状态机）；链上时间 ≥ `Event_Ts` |
| **结果** | 生成 `assertionId`；Feed/Assertion 状态 → `Proposed`；启动 `Dispute_Window` |

**核心校验：**

1. 该标识符当前无活跃 Assertion，且 Feed 未 `Finalized` / 未 `Settled_As_Null`。  
2. 扣除押金并锁定于 Assertion 对象。  
3. 记录 `proposed_at`，计算 `liveness_end_at = proposed_at + Liveness_Period`。

**争议与挑战 (Data Dispute)**

| 项 | 内容 |
| --- | --- |
| **功能** | 争议窗口内，观察者对作假或有误的提议发起链上驳回 |
| **接口** | `disputeData(bytes32 assertionId) external`（等价命名：`disputeAssertion`） |
| **前提** | 转入 ≥ `Disputer_Bond_Size` 的本位币（通常 ≥ Proposer Bond）；当前时间 ≤ `liveness_end_at` |
| **状态变更** | `Proposed` → **`In_Arbitration`**；争议倒计时**立即失效**；**冻结**该数据流，拒绝一切 Consumer 读取 |

**同一交易内必须：** 调用 `oracle_arbitrator::dispute_and_request_arbitration`（争议 + 立案，见 §10.3.3.2）。

#### 10.3.3 仲裁与纠纷解决（Arbitration & Dispute Resolution）

无仲裁模块则乐观预言机缺少「最高法院」，博弈闭环无法完成。**终裁权归属委员会（或外部 DVM 适配器），非协议 Admin 单方裁决。**

**核心状态机**

争议触发后，状态严格按以下路径流转；**仲裁期间冻结所有外部数据提取**：

```text
[Null]
   └── proposeData ──> [Proposed]
                            ├── (Dispute_Window 结束, 无挑战) ──> finalize ──> [Finalized]
                            └── disputeData ──> [In_Arbitration]
                                                      ├── 仲裁回调 (可裁决) ──> [Finalized]
                                                      └── 仲裁回调 (无法裁决) ──> [Settled_As_Null]
```

72 小时仍无任何有效提议时，Feed 可进入 `[Settled_As_Null]`（见 §10.4.3），与仲裁熔断区分：前者为「无人提议」，后者为「规则/数据源无法判定」。

**可插拔仲裁接口（Arbitration Interface）**

支持对接链下去中心化法院（**UMA DVM**）或生态内生多签/DAO 委员会。Testnet 默认实现为 `oracle_arbitrator` 模块（委员多签 + 阈值执行）。

| 角色 | 职责 | 是否 Admin |
| --- | --- | --- |
| **协议运营** | `create_oracle_config`、绑定 `OracleArbitrator` | 仅全局基础设施 |
| **市场创建者** | `create_*_with_feed` / `register_data_feed_for_pool` | 每市场 Feed，非 Admin |
| **任何人** | `propose_data`、无争议 `finalize_assertion` | 否 |
| **任何人** | `dispute_and_request_arbitration` | 否 |
| **委员会委员** | `propose_verdict` / `approve_verdict` / `execute_arbitration` | 否（独立多签） |

*1. 外部仲裁请求（Outbound Call）*

- **触发时机：** 争议成功的**同一笔 PTB** 内执行。  
- **Move 实现：**

```move
oracle_arbitrator::dispute_and_request_arbitration(
    oracle, feed, pool, assertion, arbitrator, bond, clock, ctx
);
// 内部：macro_oracle::apply_dispute + 创建 ArbitrationCase
```

*2. 仲裁结果回调（Inbound Callback）*

- **触发时机：** 委员会达阈值后，由**授权 `OracleArbitrator`** 调用 `execute_arbitration`。  
- **Move 实现：**

```move
oracle_arbitrator::execute_arbitration(...) {
    macro_oracle::callback_arbitration_result(
        oracle, feed, pool, assertion, verdict_type, resolved_value, ctx
    );
}
```

- **权限：** `OracleConfig.arbitrator_id` 必须匹配；仅 `public(package)` 回调，外部无法直接调用。  
- **同一交易内完成：** 押金清算（§10.3.3.4）+ 状态 → `Finalized`（或 `Settled_As_Null`）+ 写入最终 `resolvedValue`。

**终审裁判逻辑与异常处理**

仲裁层在核对 IPFS/链上 `Ancillary_Data` 规则文本后，须返回以下三类结果之一：

| 裁决 | 条件 | 链上行为 |
| --- | --- | --- |
| **提议者胜诉** | `isProposerCorrect == true` | 采纳原 `proposedResult` → `Finalized` |
| **挑战者胜诉** | `isProposerCorrect == false` | 采纳仲裁返回的 `resolvedValue` → `Finalized` |
| **无法裁决** | 官方未发布、规则漏洞、数据源不可验证 | **熔断**：→ `Settled_As_Null`；**双方押金原路退回**，不作惩罚 |

**押金清算与利益分配（Slasher Math）**

仲裁结果落地后，合约须在**同一区块**内自动清算。

设提议者押金 $B_p$，挑战者押金 $B_c$，仲裁协议抽成比例 $\gamma$（如 20%）。

**提议者胜诉：**

$$\text{Proposer 总所得} = B_p + B_c \times (1 - \gamma)$$

$$\text{仲裁协议/国库收入} = B_c \times \gamma$$

挑战者所得：$0$。

**挑战者胜诉：**

$$\text{Disputer 总所得} = B_c + B_p \times (1 - \gamma)$$

$$\text{仲裁协议/国库收入} = B_p \times \gamma$$

提议者所得：$0$。

**无争议 finalize（未进入仲裁）：** 提议者全额取回 $B_p$；无罚没。

**无法裁决（Settled_As_Null）：** $B_p$、$B_c$ 原路退回。

> **与 §10.4.2 的关系：** §10.4.2 定义押金**规模**（与 TVL 挂钩）；本节定义争议**清算分配**。实现上可采用简化模型（如败诉方 50% 归胜诉方、50% 归协议），但主网应对齐 $\gamma$ 与仲裁成本。

#### 10.3.4 数据消费接口（Data Egress / Consumer Interface）

| 项 | 内容 |
| --- | --- |
| **功能** | 供 DeFi / 预测市场等合约只读获取已固化宏观数据 |
| **接口** | `getFinalizedData(bytes32 dataIdentifier) external view returns (string memory)` |
| **安全防线** | 状态非 `Finalized` 时必须 **revert**（含 `Proposed`、`In_Arbitration`） |

**X-Market 结算消费示例：** 固化后将 `resolvedValue` 写入 `MarketPool`（Poisson slot / Dirichlet bucket / Normal 数值），用户调用 `settlement::claim_position` 按实际结果赔付。

### 10.4 关键安全与边界设计

#### 10.4.1 数据修正案（The Revision Problem）

政府常于数月后发布修正值（Revision）。

- **原则：** 预言机只认**初值（First Release）**。  
- **落地：** `Ancillary_Data` 须写明：「仅以官方在指定发布日**首次公布**的数据为准，后续修正不追溯。」

#### 10.4.2 经济学安全模型（Bond Sizing）

说谎成本须高于作恶收益（Profit from Corruption, PfC）：

$$Bond_{required} = \max(Minimum\_Bond,\; \alpha \times TVL_{dependent})$$

- $\alpha$：风险系数（如 0.05）。  
- $TVL_{dependent}$：依赖该数据标识符的链上总锁定价值（如关联 Pool 的 vault + 未 claim 头寸）。

#### 10.4.3 数据源宕机或长期无提议（Fallback）

- **场景：** 发布日官网宕机，或无人提议。  
- **机制：** 自 `Event_Ts` 起 **72 小时**内仍无通过争议期的有效数据 → Feed → `Settled_As_Null`。  
- **下游：** 消费方合约按各自兜底条款退款或中止（X-Market 可扩展 LP/头寸退款路径）。

### 10.5 数据状态字典（开发参考）

Assertion / Feed 须支持以下状态（命名可与 Move `u8` 常量对应）：

```solidity
enum AssertionState {
    Null,            // 尚未有人提议
    Proposed,        // 已提议，争议倒计时进行中
    In_Arbitration,  // 已被挑战，仲裁中（禁止 Consumer 读取）
    Finalized,       // 判定结束，数据已固化，可对外输出
    Settled_As_Null  // 规则/数据源异常或长期无提议，熔断作废
}
```

| 状态 | Consumer `getFinalizedData` | 说明 |
| --- | --- | --- |
| `Null` | revert | 等待提议 |
| `Proposed` | revert | 争议窗口内 |
| `In_Arbitration` | revert | 等待仲裁回调 |
| `Finalized` | 返回固化值 | 唯一可读状态 |
| `Settled_As_Null` | revert | 业务层走兜底逻辑 |

### 10.6 接口汇总

| 阶段 | 函数 | 调用方 |
| --- | --- | --- |
| 建市场+Feed | `create_*_pool_with_feed(...)` | 市场创建者（推荐） |
| 补登 Feed | `register_data_feed_for_pool(...)` | 市场创建者（`authority`） |
| 治理补登 | `register_data_feed(...)` | Admin（迁移/修复） |
| 发现 Feed | `lookup_feed_entry(registry, market_id)` | 链下 devInspect / Indexer |
| 绑定委员会 | `set_oracle_arbitrator(arbitrator_id)` | 协议运营（AdminCap） |
| 创建委员会 | `create_oracle_arbitrator(committee, threshold)` | 协议运营（AdminCap） |
| 提议 | `propose_data(...)` | 任何人（Proposer） |
| 争议 + 立案 | `dispute_and_request_arbitration(...)` | 任何人（Disputer） |
| 无争议结算 | `finalize_assertion(...)` | 任何人（窗口结束后） |
| 委员提案 | `propose_verdict(case, verdict_type, value)` | 委员会委员 |
| 委员附议 | `approve_verdict(case)` | 委员会委员 |
| 仲裁执行 | `execute_arbitration(...)` | 任何人（达阈值后） |
| 仲裁回调 | `callback_arbitration_result(...)` | 仅 `oracle_arbitrator` 内部 |
| 熔断 | `nullify_feed(...)` | 任何人（72h 无提议等） |
| 读取 | `get_finalized_value(feed)` | 任意只读调用 |

### 10.7 工程落地索引（X-Market）

| PRD 概念 | 当前实现（Testnet） |
| --- | --- |
| Feed 自动注册 | `pool::create_*_with_feed` → `macro_oracle::register_feed_for_pool` |
| FeedRegistry 发现 | `FeedRegistry` + `lookup_feed_by_market` |
| 创建者补登 | `register_data_feed_for_pool` |
| Admin 治理补登 | `register_data_feed`（遗留） |
| 委员会创建与绑定 | `oracle_arbitrator::create_oracle_arbitrator` + `set_oracle_arbitrator` |
| propose / dispute / finalize | `propose_data`, `dispute_and_request_arbitration`, `finalize_assertion` |
| 委员会终裁 | `propose_verdict` → `approve_verdict` → `execute_arbitration` → `callback_arbitration_result` |
| 无法裁决熔断 | `verdict_unresolved` → 双退押金 + Feed `Nullified` |
| 市场结算 | `finalize_*` / 仲裁回调 → `market_pool::set_resolution` → `settlement::claim_position` |
| 联调快路径（非生产） | `settlement_oracle::report_resolution`（跳过乐观流程） |
| 操作手册 | [docs/oracle-playbook.md](./docs/oracle-playbook.md) |
| 前端 | `app/src/app/oracle/page.tsx`（按 `pool_id` 链上发现 Feed） |

**待增强：** 外部 UMA DVM 适配器（替换 `OracleArbitrator` 为跨链回调）；$\gamma$ 抽成与 UMA 对齐（当前 Testnet 50/50）；Indexer 自动索引 `ArbitrationCase`。

### 10.8 参考

- UMA Optimistic Oracle / DVM 争议与投票流程  
- [uma1.md](./uma1.md) — 仲裁状态机、Slasher Math、五态枚举  
- [uma2.md](./uma2.md) — 预言机术语标准化、Optimistic Engine、仲裁 Outbound/Inbound 规范  

---

## 11. SuiProphet Network（知识付费模块）

> 完整愿景文档：[SuiProphet_Network.md](./SuiProphet_Network.md)  
> **与 X-Market 关系：** 挂载于同一 `EventRoot`（§3.7），共用 L0 统一事件中心（§3.0、§10）结算；**不**另建独立 Oracle。

### 11.0 定位说明

**SuiProphet Network** 解决传统预测市场「只博弈、不沉淀」的问题：在共享事件根节点上，为专业信息生产者（预言家/KOL）提供**事前付费可见、事后强制公开审计、全链战绩不可篡改**的知识变现闭环。

| 维度 | X-Market 博弈模块 | SuiProphet 付费模块 |
| --- | --- | --- |
| 用户动作 | 买入 `Position`，承担赔付 | 付费解锁私密分析 |
| 链上对象 | `MarketPool` / `Position` | `PrivateProphecy`（Child Object） |
| 收入方 | LP + 协议费 | 预言家 + 协议解锁费 |
| 结算依赖 | L0 Oracle `resolved_value` | 同一 `resolved_value` + `plaintext_hash` 审计 |

### 11.1 愿景与用户角色

**Sui + Walrus + Seal** 原生技术栈，抛弃跨链隐私方案，保障并行性能与链上状态可验证。

| 用户角色 | 核心行为 | 核心价值 |
| --- | --- | --- |
| **预言家 (Prophet)** | 创建公开/私密预测，设置解锁价，撰写深度分析 | 全链胜率背书；赚取解锁收入 |
| **订阅者 (Buyer)** | 浏览排行榜，USDC 解锁高胜率预言家内容 | 高质量 Alpha；跟随高胜率地址 |
| **平台方 (Protocol)** | 维护 `EventRoot` + 事件中心；Crank 驱动结算 | 解锁费抽成入国库 |

### 11.2 Seal 双重 OR 访问控制

密文托管于 **Walrus**，解密密钥由 **Seal** 管理，链上状态驱动**或门（OR）**策略：

- **条件 A（事前付费）：** 请求钱包 ∈ `PrivateProphecy.paid_buyers`
- **OR**
- **条件 B（事后公开）：** `now > lock_time` 或 `EventRoot.status == Settled`

满足任一即可解密。结算后全网免费公开，支撑战绩审计与反删帖。

### 11.3 功能模块

#### 11.3.1 事件与市场创建

- 任何用户可发起结构化预测市场（选项 A/B 或绑定已有 `EventRoot`）
- 根对象字段：`event_id`、`lock_time`、`oracle_feed_id`、`status`（与 §3.7 一致）
- 可选同时启用 AMM 博弈（Dynamic Field `b"amm"`）与 Prophet 注册表（`b"prophet_registry"`）

#### 11.3.2 私密预测发布（预言家）

标准 JSON 包装：

```json
{
  "event_root_id": "0x…",
  "predicted_value": 7,
  "analysis_content": "根据链上大户筹码密集区分析…"
}
```

流程：Seal 门限加密 → 上传 Walrus 得 `blob_id` → 链上 Commit 子对象 → 记录 `plaintext_hash`、`unlock_price_usdc`、`lock_time`。

#### 11.3.3 即时付费解锁（订阅者）

1. 浏览预言家主页 / 排行榜  
2. `unlock_prophecy`：USDC 入托管池，地址写入 `paid_buyers`  
3. 前端请求 Seal（条件 A）→ 本地解密 Walrus 密文  

#### 11.3.4 事后自动审计与结算

与 L0 Oracle **共用**结算触发，无需预言家人工干预：

```
事件到期 → L0 Oracle 固化 resolved_value
         → EventRoot.status = Settled
         → Seal 条件 B 触发（公开密钥）
         → 提取明文 → Hash(明文) == 链上 plaintext_hash
              ├─ 匹配 → 比对 predicted_value vs resolved_value → 战绩 Win/Loss
              └─ 不匹配 → 作弊标记 → 扣积分
         → 解冻解锁费：协议抽成 X% → 余款结算预言家
         → 预测对全网 Public
```

#### 11.3.5 全链战绩排行榜 (Leaderboard)

$$\text{Prophet Score} = w_1 \cdot \text{Accuracy Rate} + w_2 \cdot \log(N) + w_3 \cdot \text{ROI}$$

统计：总场次、胜率、连红、最高连红、购买者累计 ROI。$\log(N)$ 衰减纯刷量权重。

#### 11.3.6 Gas Station（赞助交易）

发布预测与付费解锁均走 **Sponsored Transactions**；用户钱包仅显示 USDC 变动，协议 Gas Payer 代付 SUI Gas。

### 11.4 安全与边界

| 机制 | 说明 |
| --- | --- |
| **内容防篡改** | 事前链上锁死 `plaintext_hash`；事后无法改明文伪造神预测 |
| **时间窗口保护** | `lock_time` 前 **5 分钟**永久关闭 `paid_buyers` 写入，防结果明朗后套利 |
| **Oracle 单一真相** | 战绩判定与 AMM 结算读取同一 L0 `resolved_value` |

### 11.5 关键 UX 流

```
【预言家】输入分析 → Seal 加密 → Walrus 上传 → 免 Gas Commit
【买方】  排行榜 → 解锁 USDC → Seal 条件 A → 即刻阅读
【审计】  Oracle 固化 → Hash 校验 → 排行榜更新 → 全网公开
```

### 11.6 工程落地索引

| PRD 概念 | 阶段 | 规划模块 |
| --- | --- | --- |
| 市场根对象 | Phase 4 | `event_root.move` |
| 私密预测 Commit / 解锁 | **已就绪** | `prophet_registry.move` + `/prophet` UI |
| 战绩与排行榜 | **已就绪（链上）** | `prophet_leaderboard.move`；Indexer 增强待办 |
| 结算触发 | **已就绪** | `macro_oracle` + `oracle_arbitrator`（§10） |
| AMM 博弈 | **已就绪** | `market_pool` + `position` + `settlement` |
| Walrus / Seal | **Testnet 已就绪** | `walrus.ts` HTTP + `seal-prophet.ts` + `seal_approve_prophecy` |
| Gas Station | Phase 4 | 赞助交易中间层 |

**迁移路径：** 现有 `MarketPool` 通过 `DataFeed.market_id` 已关联 L0 Feed；Phase 4 新增 `EventRoot` 包装层，将 `pool_id` 迁入 Dynamic Field，Prophet 子对象挂同一根节点，**不重复注册 Oracle**。

### 11.7 参考

- [SuiProphet_Network.md](./SuiProphet_Network.md) — 原始产品愿景  
- [Walrus](https://walrus.site/) · [Seal](https://seal.mystenlabs.com/) — Mysten 存储与密钥管理  
- §3.0 统一事件中心 · §3.7 EventRoot · §10 Macro Data Oracle

---

*一个事件，一种真相；博弈与先知，同根共生。*
