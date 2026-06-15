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

**简体中文** | [English](./tier2-decision.md)

# Tier 2 模型必要性决策

> **版本：** v1.0 · **日期：** 2026-06-08  
> **状态：** 已决议  
> **关联：** [PRD.zh.md](../PRD.zh.md) §3.6 · [math-spec/SPEC.zh.md](../math-spec/SPEC.zh.md) §9 · [docs/qa.zh.md](./qa.zh.md) §Tier 1/2 · [phase3-playbook.zh.md](./phase3-playbook.zh.md) §4 · [slash-and-attestation.zh.md](./slash-and-attestation.zh.md) · [deferred-features.zh.md](./deferred-features.zh.md)

---

## 决议摘要

**当前阶段（Testnet → 主网 → 增长期前 6–12 个月）不上 Tier 2 模型。**

全力投入 **Tier 1 链上数学引擎**（Poisson / Dirichlet / Normal）及已有结构化票据、LP 防守、Oracle、SuiProphet 生态。`zk_coprocessor` 不接入 `buy_*` 热路径；**异步 Brevis 监督线**已由 `services/brevis-zk-prover/` 落地（mock/live，机构合规可选启用）。

---

## 1. 术语澄清

项目内 **Tier 2 ≠ Phase 3 结构化产品**。

| 概念 | 含义 | 链上算价 |
| --- | --- | --- |
| **Tier 1** | 单变量 PDF；参数更新与积分在 Move 内原子完成 | ✅ 热路径 |
| **Tier 2** | 多维 / 联合 PDF；泰勒 / LUT 链上算不动；链下乐观算价 + 异步监督 | 链下乐观 + Attestation / ZK 冷路径 |
| **Phase 3 票据** | Variance Swap、Structured / Range / Barrier Note | **仍是 Normal + Tier 1** |

常见误解：Variance Swap 等 Phase 3 能力已上线，但它们不触发 Tier 2；只有 **联合高维 PDF** 才需要 Tier 2 架构（见 [qa.zh.md](./qa.zh.md) §Tier 2）。

---

## 2. Tier 1 已覆盖范围

| 场景 | Tier 1 方案 | 实现状态 |
| --- | --- | --- |
| 足球进球 | Poisson | ✅ |
| 胜平负 / 选举 | Dirichlet | ✅ |
| CPI / BTC / TPS | Normal | ✅ |
| 数字 / 区间 / Call / Put / Straddle | 三种分布 | ✅ |
| Variance / Structured / Range / Barrier | Normal 衍生 | ✅ |
| 得票率 [0, 1] | Dirichlet 近似 Beta（[SPEC.zh.md](../math-spec/SPEC.zh.md) §7） | ✅ 规格已定 |
| 「主队赢 AND 进球 > 2.5」 | **独立双池 + Indexer 乘法**（[SPEC.zh.md](../math-spec/SPEC.zh.md) §9） | ✅ MVP 路径 |

种子市场（`app/src/lib/markets.ts`）即为 Poisson / Dirichlet / Normal 三池，无需 Tier 2 即可跑通完整产品闭环。

---

## 3. 为何当前不必上 Tier 2

### 3.1 需求面

预测市场绝大多数为单变量或可分池事件。math-spec 明确：

> 链上**不**实现联合 PDF；前端 / Indexer 分别读取两个 Pool 状态后乘法合成，标注「独立假设」。

独立假设对主流体育 / 宏观场景误差通常可接受；强相关联合分布属于长尾需求。

### 3.2 工程面

Tier 2 引入额外运维与信任成本：

- 链下计算节点 + 验证委员会 + 挑战 / slash 争议处理
- `zk_coprocessor` **尚未接入** `pool::buy_*` 热路径
- Brevis 链下 Prover Keeper 已集成（`services/brevis-zk-prover/`）；链上仍为 Attestation 过渡层，待 Sui 原生验算器（见 [phase3-playbook.zh.md](./phase3-playbook.zh.md) §4.5）
- 信任模型从「链上可验」退为「乐观执行 + 事后追责」

主网阻断项（外部审计、治理签字、应急演练）尚未完成，不宜分散投入 Tier 2。

### 3.3 性能面

参数化 AMM 热路径要求：**单笔交易内原子更新 μ / σ / λ / α**。

| 方案 | 延迟 | 能否放交易热路径 |
| --- | --- | --- |
| Tier 1 链上定点数 | 毫秒级 | ✅ |
| Attestation（hash + quorum） | 毫秒～秒 | ✅ |
| ZK 证明生成 + 链上验算 | 秒～分钟；Move 无原生预编译 | ❌ |

Tier 1 毫秒原子、零外部依赖是核心工程优势；Tier 2 本质为算力换可验证性，不应替代主路径。详见 [qa.zh.md](./qa.zh.md) §Tier 1/2 对比。

### 3.4 商业面

PRD §7 KPI（种子市场、周活、TVL）均不依赖 Tier 2。Tier 2 对应远期机构 AUM / 复杂衍生品场景，非 MVP 阻断项。

---

## 4. 其他延期项（Beta · UMA DVM · Normal 竞价）

与 Tier 2 无关、但 PRD 有规划的 **Tier 1 扩展 / Oracle 治理** 缺口，见 [deferred-features.zh.md](./deferred-features.zh.md)。Normal 竞价与 UMA DVM 适配器已实现；主网前仍不阻断项：Beta CDF。

---

## 5. Attestation 与 ZK 的定位（补充）

Tier 2 **若未来启用**，监督线可选 Attestation 或异步 ZK，均**不阻塞交易**：

- **Attestation + 挑战约束**：性能满足热路径登记；信任依赖验证委员会 + slash（与 Macro Oracle 同类模型）；详见 [slash-and-attestation.zh.md](./slash-and-attestation.zh.md)
- **真 ZK（Brevis 等）**：提供密码学可验证性；仅适合异步审计 / 机构合规，不适合实时报价

当前 `zk_coprocessor` 为 Attestation 过渡层，**不能**等同于链上 Groth16 / Plonk 验算。主路径不依赖 ZK；真 ZK 为机构级长尾升级项。

---

## 6. 何时重新评估 Tier 2

满足以下**至少一条**时，启动 Tier 2 立项评审：

| 触发条件 | 示例 |
| --- | --- |
| 强相关无法独立近似 | 「降息幅度 × 失业率」联合分布，双池乘法误差影响定价 |
| 单池资本效率刚需 | 机构要求单一 Vault 承载多维敞口 |
| 链上算不动的 PDF | 多维高斯、copula、动态相关矩阵 |
| 合规明确要求 | 对手方不接受 Attestation，要求 validity proof |
| 流动性碎片化瓶颈 | 独立池方案导致滑点 / TVL 撕裂不可接受 |

参考阈值（[mainnet-infra-priority.zh.md](./mainnet-infra-priority.zh.md)）：活跃市场 > 50 或 Prophet 预测 > 200 之前，上述条件通常不会成为真痛点。

---

## 7. 推荐路线

```
现在 ～ 主网后 6–12 个月
  ├── 全力 Tier 1：三种分布 + 结构化票据 + LP 防守 + Oracle + Prophet
  └── 复合事件：独立双池 + Indexer 展示，UI 标注「独立假设」

触发条件满足时
  ├── 先评估 Tier 1 扩展（更多 Normal 池、链下 Copula 预览）
  ├── 仍不够 → Tier 2 乐观执行 + Attestation 监督
  └── 机构合规倒逼 → 异步 ZK 审计线（仍不阻塞交易）

明确不做
  ├── 为「架构完整性」提前上多维联合 PDF
  └── 为接 Brevis 而接 Brevis
```

**`zk_coprocessor`：** 保留模块与治理流程，不接入 `buy_*`，不阻断主网上线。

---

## 8. 结论对照

| 问题 | 答案 |
| --- | --- |
| 主网要不要上 Tier 2？ | **不要** |
| MVP 缺 Tier 2 能跑吗？ | **能**，且为设计本意 |
| Tier 2 方向错误吗？ | 否，是**远期选项** |
| 当前优先级？ | Tier 1 运营、主网上线、流动性、Oracle、Prophet |

---

## 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-06-08 | v1.0 | 初版：决议不上 Tier 2；澄清 Tier 1/2 边界与 Attestation/ZK 分工 |
| 2026-06-08 | v1.1 | 增加 §4 延期项索引，链接 [deferred-features.zh.md](./deferred-features.zh.md) |
