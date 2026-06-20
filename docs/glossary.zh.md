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

**简体中文** | [English](./glossary.md)

# X-Market Sui 术语百科

> **版本：** v1.0 · **日期：** 2026-06-19  
> **定位：** 全系统名词解释与快速索引；每条 1–3 句定义 + 深读链接。  
> **不替代：** 长篇教程见 [qa.zh.md](./qa.zh.md)；工程细节见各 playbook 与 [math-spec/SPEC.zh.md](../math-spec/SPEC.zh.md)。

---

## 如何使用

| 你想… | 去哪里 |
| --- | --- |
| 查一个词是什么意思 | 本文对应章节，或文末 [索引](#索引) |
| 理解完整业务故事 | [business-spec.zh.md](./business-spec.zh.md) |
| 看公式与链上实现 | [on-chain-distribution-math.zh.md](./on-chain-distribution-math.zh.md) |
| 对外短答 | [faq-public.zh.md](./faq-public.zh.md) |
| 运维操作 | 各 phase playbook / runbook |

---

## 1. 产品与架构

| 术语 | 解释 | 深读 |
| --- | --- | --- |
| **X-Market** | Sui 上的**博弈模块**：用户用 USDC 买入 `Position`，LP 承担赔付；定价基于参数化 AMM 与概率分布。 | [PRD.zh.md §2](../PRD.zh.md) |
| **SuiProphet** | **预言家模块**：筛选可验证预测者、积累链上战绩；达标后可开通知识付费（Seal 加密分析）。 | [SuiProphet_Network.zh.md](../SuiProphet_Network.zh.md) |
| **统一全链事件中心 / Unified Event Engine** | L0 Oracle 层，全产品**唯一结算真相源**；博弈兑付与预言审计共用同一 `resolved_value`。 | [PRD.zh.md §3.0](../PRD.zh.md) |
| **EventRoot（市场根对象）** | L1 抽象：绑定现实世界事件、`lock_time`、Oracle Feed；挂载 AMM 池与 Prophet。Testnet 中 `MarketPool` 兼作事实根节点；显式 `event_root` 为 Phase 4。 | [PRD.zh.md §3.7](../PRD.zh.md) |
| **L0 / L1 / L2** | 三层架构：L0=Oracle 结算；L1=市场根；L2=博弈（AMM）或付费（Prophet）业务模块。 | [business-spec.zh.md §1.3](./business-spec.zh.md) |
| **Parametric AMM（参数化做市商）** | 池内维护分布参数（μ/σ/λ/α），交易即更新参数；区间价格由 PDF 积分得出，非 x·y=k 代币互换。 | [qa.zh.md §二](./qa.zh.md) |
| **Tier 1** | 单变量分布；参数更新与概率计算在 Move 内**原子完成**，为 MVP 热路径。 | [tier2-decision.zh.md](./tier2-decision.zh.md) |
| **Tier 2** | 多维/联合 PDF；链下乐观算价 + 异步 Attestation/ZK 监督；**主网前决议不上**。 | [tier2-decision.zh.md](./tier2-decision.zh.md) |
| **Pricing Engine / Preview** | 链下 `pricing-engine/`，镜像链上数学做报价预览；**链上为唯一真相源**。 | [math-spec/SPEC.zh.md](../math-spec/SPEC.zh.md) |
| **万物皆对象** | Sui 建模原则：`MarketPool`、`Position`、`PrivateProphecy` 等均为链上 Object，可并行、可组合。 | [PRD.zh.md §1.3](../PRD.zh.md) |

---

## 2. 计量单位与编码

| 术语 | 解释 | 示例 / 公式 |
| --- | --- | --- |
| **bps（basis point，基点）** | 1 bps = 0.01%；10 000 bps = 100%。费率、乘数、Slash 上限等均用 bps。 | 200 bps = 2% 费率 |
| **tenths** | Normal 市场定点刻度：数值 ×10 存链。CPI 2.5% 常写作 `25 tenths`。 | `sigma_tenths`、`mu_tenths` |
| **ppb（parts per billion）** | 概率的十亿分比；`entry_prob_ppb` 记录买入时理论概率。 | 700_000_000 ppb ≈ 0.70 |
| **permille（千分比）** | Beta 分布链上刻度，0–1000 表示 [0, 1] 区间端点。 | `x_permille = 250` → 25% |
| **Q32.32 定点数** | 链上禁止浮点；概率以 `u128` 存储，`1.0` = `2^32`。 | [fixed_point.move](../sources/math/fixed_point.move) |
| **USDC / mist** | 结算与 Vault 计价单位；Circle 原生 USDC，6 位小数（1 USDC = 10⁶ mist）。 | `vault` `Balance<USDC>` |
| **mist（SUI）** | Sui 原生代币最小单位；链上交易 Gas 以 SUI 支付（Prophet 由用户钱包自付）。 | — |

---

## 3. 概率、分布与 PDF

| 术语 | 解释 | 链上模块 / 场景 |
| --- | --- | --- |
| **PDF（概率密度函数）** | 连续变量的概率密度；产品语境下常泛指「用一条曲线描述事件结果分布」。 | — |
| **PMF（概率质量函数）** | 离散变量在单点的概率，如 Poisson 的 P(X=k)。 | `poisson.move` |
| **CDF（累积分布函数）** | P(X ≤ x)；Normal 区间定价用 Φ(b)−Φ(a)。 | `normal.move` |
| **链上不算完整 PDF** | Move 只计算**定价所需概率量**（PMF、边际概率、区间积分），不存储整条密度曲线。 | [on-chain-distribution-math.zh.md §1](./on-chain-distribution-math.zh.md) |
| **Poisson(λ)** | 离散计数分布；λ 为期望计数。用于足球总进球等。 | `buy_poisson_*` |
| **Dirichlet(α[])** | 多类别分布；边际概率 pᵢ = αᵢ/Σα。用于胜平负、选举。 | `dirichlet.move` |
| **Normal(μ, σ)** | 连续正态分布；μ 为均值预期，σ 为不确定性。用于 CPI、BTC、宏观区间。 | `normal.move` |
| **Beta(α, β)** | [0,1] 比例事件；得票率等。链上用 Beta CDF + permille。 | `beta.move` |
| **Skellam** | 两独立 Poisson 之差 Z=X−Y 的分布；足球 WDL 底层推导方案（链下引擎 + 链上系数）。 | [football-wdl-solution.zh.md](./football-wdl-solution.zh.md) |
| **Categorical / Multinoulli** | 单次多项试验，K 个互斥类别之一；胜平负表层结算语义。 | [football-wdl-solution.zh.md](./football-wdl-solution.zh.md) |
| **联合 PDF / 复合事件** | 多维联合分布，如「主队赢 AND 进球>2.5」。MVP：**独立双池 + Indexer 乘法**，标注独立假设。 | [tier2-decision.zh.md §2](./tier2-decision.zh.md) |
| **Prior（先验）** | 建池或竞价定标前的初始参数（μ₀、α₀、λ₀）。 | Opening Auction |
| **滑点（Slippage）** | 大额交易推动参数偏离，使实际成交价高于理论 PDF 概率；LP 主要收入来源之一。 | [qa.zh.md §LP](./qa.zh.md) |
| **LUT（查找表）** | 离线预计算超越函数（e^−λ、erf）并编译进 Move，降低 Gas。 | [on-chain-distribution-math.zh.md §2.3](./on-chain-distribution-math.zh.md) |

---

## 4. 合约类型与头寸

| 术语 | 解释 | `contract_kind` |
| --- | --- | --- |
| **Interval（区间合约）** | 结果落在 [a,b] 则每份兑付 1 USDC，否则归零。 | 0 |
| **Digital（数字期权）** | 命中精确结果（Poisson 的 k、Dirichlet 类别、Normal 阈值）则兑付。 | 1 |
| **Linear Call** | 收益 ∝ max(X−K, 0)，离散槽位近似。 | 2 |
| **Linear Put** | 收益 ∝ max(K−X, 0)。 | 3 |
| **Straddle** | 收益与 \|X−K\| 相关；买入推高 σ，表达「波动率看多」。 | 4 |
| **Variance Swap** | 收益与 (X−K)² 相关；对尾部波动最敏感。Phase 3，仍属 Tier 1。 | 5 |
| **Structured Note（封顶看涨）** | min(max(X−K,0), C−K)；上涨有封顶。 | 6 |
| **Range Note（区间票息）** | X∈[L,U] 支付固定票息。 | 7 |
| **Barrier Note（障碍票息）** | X≥B 支付固定票息。 | 8 |
| **Position** | 用户持有的链上 owned object；记录合约类型、区间、成本概率、兑付状态。 | `position.move` |
| **Strike / 行权价 K** | 期权类合约的参考点位（Normal 用 tenths）。 | 交易面板 |
| **claim / 兑付** | Oracle 结算后，`claim_position` 将命中头寸换成 USDC。 | `settlement.move` |

---

## 5. AMM、LP 与流动性

| 术语 | 解释 | 深读 |
| --- | --- | --- |
| **MarketPool** | 共享 AMM 池：vault、分布参数、状态、LP Guard 字段。 | `market_pool.move` |
| **Vault** | 池内 USDC 余额；交易者买入注入，兑付/LP 赎回流出。 | — |
| **LP（流动性提供者）** | 向池注入 USDC，获得 `LpShare`；角色类似承销商，赚滑点与错误预测本金，承担逆向选择。 | [qa.zh.md §LP](./qa.zh.md) |
| **LpShare / LP Token** | LP 份额凭证，owned object；赎回时按 NAV 兑付。 | `lp_token.move` |
| **NAV（净值）** | (vault 现金 − 负债 MTM) / lp_shares；申购赎回的定价基准。 | [PRD.zh.md §2.10](../PRD.zh.md) |
| **L_mtm（负债盯市）** | 未结算头寸最坏情景赔付；NAV 与 Max-Loss 检查的核心输入。 | `risk.move` |
| **Max-Loss 检查** | 每笔 `buy_*` 前验证：新增头寸后最坏赔付 ≤ Vault。 | `risk.move` |
| **deposit_liquidity** | LP 申购：按 NAV 铸份额，等比放大 α（Dirichlet）而不改边际概率。 | Phase 1.5 |
| **withdraw_liquidity** | LP 赎回：burn 份额 × NAV 取回 USDC。 | Phase 2 |
| **Opening Auction（开盘竞价）** | 市场创建后先竞价：USDC 进入各结果桶 → `finalize` 定 α₀/Vault → 进入 Trading。 | [qa.zh.md §开盘竞价](./qa.zh.md) |
| **auction_deposit / auction_bid** | 竞价期向各桶注资，不参与 AMM 连续交易。 | `pool.move` |
| **finalize_auction** | 竞价截止原子定标，开启 Trading。 | — |
| **Round-Trip Churn（路径积分）** | 概率来回交易后回归原位，Vault 仍可能因滑点沉淀溢价。 | [PRD.zh.md §2.8](../PRD.zh.md) |
| **T₀ / T₁ / T₂ 加入时机** | T₀ 开盘拓荒；T₁ 中场扩容；T₂ 封盘前禁申购（`deposit_cutoff_bps`）。 | [qa.zh.md §LP 时机](./qa.zh.md) |
| **Pool Authority** | 有权调用 `set_lp_guard_params` 的地址；Keeper 须持有对应私钥。 | [phase2-playbook.zh.md](./phase2-playbook.zh.md) |

---

## 6. LP Guard 与风控

| 术语 | 解释 | 字段 / 模块 |
| --- | --- | --- |
| **LP Guard** | Phase 2 LP 防守套件：动态费率、虚拟流动性、申购截止、结算时间锁。 | `lp_guard.move` |
| **fee_bps** | 池子**基础**交易费率（建池时设定）。 | `MarketPool` |
| **fee_multiplier_bps** | 动态费率**乘数**；有效费率 = `fee_bps × (10000 + mult) / 10000`。 | `lp_guard::effective_fee_bps` |
| **deposit_cutoff_bps** | 生命周期后段禁止 LP 申购的比例；1000 bps = 最后 10% 时间。 | `assert_deposit_window_open` |
| **resolution_window_ts** | 到期前禁止 `buy_*` 的时间窗口（秒）。 | `assert_buy_window_open` |
| **sigma_virtual_tenths** | 虚拟 σ；风险升高时抬高，使曲线更「钝」，抑制逆向选择。 | Keeper 写入 |
| **concentration_virtual** | Dirichlet 虚拟浓度；抬高类别间分散度防守。 | Keeper 写入 |
| **paused** | 池暂停交易；Slash 或紧急处置后 `buy_*` 被拒。 | `slash_pool` |
| **LP Guard Keeper** | 链下服务，轮询池状态，按风险分自动 `set_lp_guard_params`。 | `services/lp-guard-keeper/` |
| **风险评分（Keeper）** | 0.4×参数漂移 + 0.35×单边偏度 + 0.25×成交量 EMA；满分时有效费率可达 800 bps。 | [phase2-playbook.zh.md](./phase2-playbook.zh.md) |
| **DECAY_FACTOR** | 风险消退时 `fee_multiplier_bps` 按 tick 衰减（默认 ×0.85）。 | Keeper 配置 |
| **Cross-Margin（交叉保证金）** | 同一地址、同一池下多 `Position` 统一记账的 `MarginAccount`；聚合 slot 负债。 | `cross_margin.move` |
| **MarginAccount** | 用户持有的保证金账本 owned object。 | — |
| **Slash** | 从池抵押罚没 USDC、暂停市场、设恢复 timelock 的链上风控处置。 | [slash-and-attestation.zh.md](./slash-and-attestation.zh.md) |
| **SlashRequest** | 多签治理发起的扣减请求；受单次 30%、周期 50% 上限约束。 | `slash.move` |
| **emergency_void / Voided** | Admin 紧急作废市场（赛事取消等）；头寸可退款，LP 可赎回。 | `emergency_cancel.move` |

---

## 7. 波动率

| 术语 | 解释 | 深读 |
| --- | --- | --- |
| **σ / sigma** | 分布不确定性参数；Normal 为 `sigma_tenths`，Poisson 亦有 σ 相关防守字段。 | [qa.zh.md §3](./qa.zh.md) |
| **IV（隐含波动率）** | 由当前 σ 与费率推导的「事件波动」指标；非传统股价历史波动率。 | `IvPanel` |
| **Vol Crush** | 临近到期时 σ 快速塌缩；Indexer 写入 `iv_history` 供前端柱状图展示。 | [p2-indexer-runbook.zh.md](./p2-indexer-runbook.zh.md) |
| **Vol Smile** | 不同行权价/区间隐含波动率差异；概念层描述，Indexer 可扩展展示。 | [qa.zh.md](./qa.zh.md) |
| **iv_history** | Indexer 表：池 σ、虚拟 σ、有效费率的时间序列快照。 | `GET /v1/pools/:id/iv-history` |

---

## 8. Oracle 与结算

| 术语 | 解释 | 模块 |
| --- | --- | --- |
| **Macro Data Oracle** | 宏观/体育等事件的乐观博弈预言机：提议 → 争议期 → 可选委员会终裁。 | `macro_oracle.move` |
| **DataFeed** | 某一指标/市场的 Oracle 注册对象，固化后含 `resolved_value`。 | `macro_oracle` |
| **DataAssertion** | 单次 `propose_data` 的乐观提议记录。 | — |
| **FeedRegistry** | 全局 Feed 索引；支持按 `market_id` 发现 Feed。 | — |
| **propose_data** | Proposer 质押后提交 `claimed_value`。 | — |
| **liveness / 争议窗口** | 提议后等待期；期内可 `dispute`，期满无争议则 finalize。 | 默认 24h |
| **minimum_bond** | 提议最低质押 USDC。 | `OracleConfig` |
| **Disputer** | 争议窗口内发起 `dispute_and_request_arbitration` 的角色。 | — |
| **ArbitrationCase** | 争议立案后的委员会仲裁案件。 | `oracle_arbitrator.move` |
| **OracleArbitrator** | 多签委员会终裁模块；可插拔 UMA DVM 适配。 | — |
| **resolved_value / claimed_value** | 固化赛果/数据值；Poisson 为进球数 k，Normal 为 tenths 槽位等。 | [oracle-playbook.zh.md](./oracle-playbook.zh.md) |
| **set_resolution / report_resolution** | 将 Feed 结果写入 `MarketPool`，触发 Settled。 | `pool.move` |
| **finalize_assertion** | 无争议路径下固化 Feed。 | — |
| **nullify_feed** | 作废 Feed（数据不可用等）。 | — |
| **Oracle Relayer** | 链下服务：到期自动 finalize / nullify。 | `services/oracle-relayer/` |
| **UMA DVM** | 可选外部争议裁决；`UMA_DVM_MODE=mock/live`。 | `services/uma-dvm-relayer/` |
| **settlement_oracle** | Admin 快速上报；**仅 Testnet 联调**，非生产路径。 | — |
| **lock_time / maturity_ts** | 市场到期时刻；Oracle 结算与 Prophet 审计的时间锚。 | `MarketPool` |

---

## 9. Attestation、ZK 与监督线

| 术语 | 解释 | 深读 |
| --- | --- | --- |
| **Attestation（见证）** | 链上登记 `proof_hash` + 委员会投票，**不**在 Move 内验算 Groth16/Plonk。 | [slash-and-attestation.zh.md](./slash-and-attestation.zh.md) |
| **zk_coprocessor** | ZK 监督链上模块：`submit_proof` → 委员见证 → 挑战窗口 → finalize。 | `zk_coprocessor.move` |
| **ZkProofTicket** | 提交的证明哈希票据（owned）。 | — |
| **ZkVerifierPolicy** | 验证委员会地址与阈值。 | — |
| **挑战窗口** | Attestation finalize 前 3600s，可 `challenge_verification`。 | — |
| **Brevis ZK Prover** | 链下可生成真 ZK，链上仍走 Attestation 登记。 | `services/brevis-zk-prover/` |
| **冷路径 / 热路径** | `buy_*` 为热路径（Tier 1 链上原子）；ZK/Attestation 为冷路径监督，不阻塞交易。 | [phase3-playbook.zh.md](./phase3-playbook.zh.md) |
| **乐观执行 + 事后追责** | Tier 2 / ZK 监督线的信任模型：先执行，争议后 Slash。 | [tier2-decision.zh.md](./tier2-decision.zh.md) |

---

## 10. SuiProphet 预言家

| 术语 | 解释 | 深读 |
| --- | --- | --- |
| **Prophet（预言家）** | 对某 `market_id` 提交预测的分析者；战绩由 Oracle 事后审计。 | [prophet-playbook.zh.md](./prophet-playbook.zh.md) |
| **PrivateProphecy** | 单次预测载体（shared object）：密文 blob、hash、unlock_price、paid_buyers。 | `prophet_registry.move` |
| **ProphetRegistry** | 协议级注册表：预言计数、协议费（默认 500 bps = 5%）。 | — |
| **commit_private_prophecy** | 预言家提交预测；`lock_time` = 池 `maturity_ts`。 | — |
| **ProphetStats / 战绩** | 链上 wins/losses/cheats/score_bps；**筛选真相源**，Indexer 仅缓存。 | `prophet_leaderboard.move` |
| **Prophet Score（score_bps）** | 综合胜率+经验+收入的评分，满分 10000；付费门槛 ≥ 4000。 | [business-spec.zh.md §2.2](./business-spec.zh.md) |
| **paid_unlock_eligible** | 无作弊、审计场次 ≥3、score ≥4000 才可设 `unlock_price > 0`。 | — |
| **unlock_prophecy** | 订阅者付 USDC 解锁；地址写入 `paid_buyers`。 | — |
| **audit_prophecy** | Oracle 结算后校验明文 hash，更新 WIN/LOSS/CHEAT。 | — |
| **CHEAT** | 审计判定作弊；永久失去付费资格。 | — |
| **Seal** | Mysten 条件解密；解密须满足 paid ∥ lock_time 后 ∥ public。 | [prophet-market-and-encryption-guide.zh.md](./prophet-market-and-encryption-guide.zh.md) |
| **seal_id / blob_id** | 32 字节密钥 id；`idx:`（Indexer 本地）或 `ipfs:` 存储前缀。 | — |
| **plaintext_hash** | blake2b256(canonical JSON)；审计时与解密明文比对。 | — |
| **练手期** | `unlock_price = 0`，免费公开预测以积累战绩。 | — |
| **Prophet Audit Keeper** | 链下：Oracle 固化后自动触发 `audit_prophecy`。 | `services/` |
| **ROI 面板** | Indexer 聚合跟单收益展示；`/roi` 页面。 | [p2-indexer-runbook.zh.md](./p2-indexer-runbook.zh.md) |

---

## 11. 链上对象与权限

| 术语 | 类型 | 说明 |
| --- | --- | --- |
| **GlobalConfig** | shared | 协议全局配置 |
| **AdminCap** | owned | 管理员能力；创建 Oracle、Slash、void 等 |
| **MarketPool** | shared | AMM 池主体 |
| **Position** | owned | 用户头寸 |
| **LpShare** | owned | LP 份额 |
| **DataFeed** | shared | Oracle 指标 |
| **ArbitrationCase** | shared | 仲裁案件 |
| **EventRoot** | shared | 市场根（Phase 4） |
| **Shared / Owned Object** | — | Sui 对象模型：池子共享；头寸、LP 份额归用户 |

---

## 12. 链下服务

| 服务 | 端口（典型） | 职责 |
| --- | --- | --- |
| **Indexer** | 8800 | Postgres 索引 + REST：市场发现、IV、排行榜、GMV、Prophet blob |
| **LP Guard Keeper** | 8788 | 自动调 LP Guard 参数 |
| **Oracle Relayer** | — | 到期自动 finalize/nullify |
| **UMA DVM Relayer** | — | 消费争议事件，回调仲裁 |
| **Brevis ZK Prover** | — | 生成 proof_hash 走 Attestation |
| **Prophet Audit Keeper** | — | 自动 audit_prophecy |
| **chain-monitor** | — | 链上健康监控 |

---

## 13. 市场生命周期与状态

| 状态 | 值 | 含义 |
| --- | --- | --- |
| **Auction** | 0 | 开盘竞价中，`buy_*` 不可用 |
| **Trading** | 1 | 正常交易 |
| **Settled** | 2 | Oracle 已结算，可 claim |
| **Voided** | 3 | 紧急作废，可退款/赎回 |

流程：**创建池 → Auction → finalize → Trading → Oracle → Settled**（异常 → Voided）。详见 [business-spec.zh.md §4.1](./business-spec.zh.md)。

---

## 14. 应用层与协议

| 术语 | 解释 |
| --- | --- |
| **PTB（Programmable Transaction Block）** | Sui 可编程交易块；Prophet / 交易等由钱包签名并支付 SUI Gas。 |
| **Sponsored Transaction** | Gas 由第三方 `gasOwner` 代付的交易模式（**本产品已移除 Gas Station，默认不使用**）。 |
| **GMV** | Indexer 统计的总成交额（Gross Merchandise Volume）。 |
| **GeoBlock** | 前端按 IP 国家限制 Web 访问；**不**阻止直接链上交互，**不**替代 KYC。 |
| **非托管** | 用户资产在自有钱包与链上对象中，协议不托管私钥。 |
| **Faucet** | Testnet 测试 USDC 铸造入口。 |
| **Quant SDK** | 对外量化 API（规划中/部分落地）。 |
| **Dynamic Fields** | Sui 动态字段；`EventRoot` 挂载子模块扩展的方式。 |

---

## 15. 合规与治理

| 术语 | 解释 |
| --- | --- |
| **治理参数签字** | 主网上线前双人复核锁定 LP Guard、Slash、协议费等基线。 |
| **协议费** | Prophet 解锁收入中协议抽取比例，默认 500 bps（5%）。 |
| **timelock** | Slash 恢复、治理变更等的链上等待期。 |
| **quorum / 阈值** | 委员会多签所需最少同意票数（如 2-of-3）。 |

主网默认值见 [mainnet-governance-params.zh.md](./mainnet-governance-params.zh.md)。

---

## 16. 易混淆对照

| A | B | 区别 |
| --- | --- | --- |
| Tier 1 | Tier 2 | 单变量链上原子算价 vs 联合 PDF 链下乐观 |
| Tier 2 | Phase 3 票据 | Variance Swap 等仍是 Normal + Tier 1 |
| PDF | 链上实际计算 | 链上算概率量，非完整密度函数 |
| IV | 股票 IV | 此处为事件驱动 σ，来自信息流而非历史价格 |
| Oracle | AMM 定价 | Oracle **仅结算**；禁止更新 λ/μ/σ |
| Attestation | 链上真 ZK | Move 无原生验算器；登记哈希+委员会见证 |
| Indexer 排行榜 | ProphetStats | 战绩真相在链上；Indexer 为缓存增强 |
| MarketPool | EventRoot | Testnet 池兼根；Phase 4 显式 EventRoot |
| Preview | 链上定价 | Preview 仅供预览；成交以链上为准 |
| GeoBlock | KYC | 仅限制前端地域，非身份验证 |
| bps 费率 | 滑点 | 费率为协议抽取；滑点为参数推动导致的成交价偏离 |
| LP Guard | Slash | 前者为日常动态防守；后者为重大风控罚没 |
| SuiProphet 商城 | 预言家筛选 | 模块主线是筛选+审计，付费是达标后的特权 |

---

## 索引

按字母/拼音快速跳转（括号内为章节号）：

**A** Attestation(9) · Auction(5) · AdminCap(11)  
**B** Barrier Note(4) · Beta(3) · bps(2) · Brevis(9)  
**C** CDF(3) · CHEAT(10) · claim(4) · Cross-Margin(6) · Categorical(3)  
**D** DataFeed(8) · deposit_cutoff_bps(6) · Digital(4) · Dirichlet(3) · Disputer(8)  
**E** EventRoot(1) · emergency_void(6)  
**F** fee_bps(6) · fee_multiplier_bps(6) · FeedRegistry(8) · finalize_auction(5)  
**G** GeoBlock(14) · GMV(14)  
**I** IV(7) · Interval(4) · Indexer(12)  
**K** Keeper(6)  
**L** lock_time(8) · LP(5) · LP Guard(6) · LpShare(5) · LUT(3)  
**M** Macro Oracle(8) · MarginAccount(6) · MarketPool(5) · maturity_ts(8)  
**N** NAV(5) · Normal(3)  
**O** Opening Auction(5) · Oracle(8)  
**P** PDF(3) · PMF(3) · Poisson(3) · Position(4) · Prophet(10) · Prior(3) · PTB(14)  
**Q** Q32.32(2) · quorum(15)  
**R** Range Note(4) · resolved_value(8) · ROI(10)  
**S** Seal(10) · Settled(13) · Skellam(3) · Slash(6) · Slippage(3) · Straddle(4) · sigma(7)  
**T** tenths(2) · Tier 1/2(1) · Trading(13)  
**U** UMA DVM(8) · USDC(2)  
**V** Vault(5) · Variance Swap(4) · Vol Crush(7) · Voided(13)  
**Z** zk_coprocessor(9)

---

## 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-06-19 | v1.0 | 初版：覆盖博弈、Oracle、Prophet、服务、风控全系统名词 |
