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

**简体中文** | [English](./Macro_Data_Oracle.md)

# 产品需求文档 (PRD)：宏观经济数据乐观预言机 (Macro Data Oracle)

## 0. 定位说明

**宏观数据源预言机（Macro Data Oracle）** 的核心任务是：为链上生态提供真实、不可篡改的宏观经济指标（如 GDP、CPI 等）。它**不需要**预测市场式的 Commitment / 下注阶段，角色是链上的「数据搬运工与公证处」——供 DeFi、保险、**预测市场结算**等智能合约只读消费。

本文档术语统一采用预言机语义（`dataIdentifier`、`proposedResult`、`assertionId`），避免混用预测市场词汇（如 `marketId`、`proposeOutcome`）。

---

## 1. 文档概述

| 项 | 说明 |
| --- | --- |
| **产品定位** | 基于乐观博弈（Optimistic Oracle）的链上宏观/财务数据源 |
| **核心目标** | 允许任何链下节点将官方发布的宏观数据搬运上链；通过质押与挑战确保真实性；固化后开放给全网合约调用 |
| **闭环四阶段** | 提议 → 挑战 → **仲裁** → 清算（缺一不可；无仲裁则经济博弈无法闭合） |

---

## 2. 系统核心业务流程

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

---

## 3. 功能需求详情

### 3.1 宏观指标定义与注册（Data Identifier Registry）

为防止对同一指标理解歧义，链上须对每条宏观数据进行标准化注册。

**注册要素：**

| 字段 | 说明 |
| --- | --- |
| `Data_Identifier` | 唯一标识（例：`US_CPI_2026_M05`） |
| `Ancillary_Data` | 权威 URL（如 `bls.gov`）、精确定义（如「未季调 CPI 年率」）、**初值原则**（见 §4.1） |
| `Liveness_Period` | 争议窗口时长（秒） |
| `Bond_Required` | 提议/挑战最低押金（可与 TVL 挂钩，见 §4.2） |
| `Event_Ts` | 官方数据可提议的最早链上时间（通常 ≥ 关联合约/市场的 maturity） |
| `Linked_Consumer` | 可选：绑定的消费方对象 ID（如 X-Market `MarketPool`） |

---

### 3.2 提议与争议机制（The Optimistic Engine）

乐观预言机的经济学引擎：通过质押博弈使链下真实数据暂存于链上。

#### 3.2.1 数据提议 (Data Proposal)

| 项 | 内容 |
| --- | --- |
| **功能** | 宏观事件发生后，Proposer 将官方数据明文搬运上链 |
| **接口** | `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)` |
| **前提** | 转入 ≥ `Proposer_Bond_Size` 的系统本位币（如 USDC）；`dataIdentifier` 处于可提议状态（见 §5 状态机）；链上时间 ≥ `Event_Ts` |
| **结果** | 生成 `assertionId`；Feed/Assertion 状态 → `Proposed`；启动 `Dispute_Window` |

**核心校验：**

1. 该标识符当前无活跃 Assertion，且 Feed 未 `Finalized` / 未 `Settled_As_Null`。  
2. 扣除押金并锁定于 Assertion 对象。  
3. 记录 `proposed_at`，计算 `liveness_end_at = proposed_at + Liveness_Period`。

#### 3.2.2 争议与挑战 (Data Dispute)

| 项 | 内容 |
| --- | --- |
| **功能** | 争议窗口内，观察者对作假或有误的提议发起链上驳回 |
| **接口** | `disputeData(bytes32 assertionId) external`（等价命名：`disputeAssertion`） |
| **前提** | 转入 ≥ `Disputer_Bond_Size` 的本位币（通常 ≥ Proposer Bond）；当前时间 ≤ `liveness_end_at` |
| **状态变更** | `Proposed` → **`In_Arbitration`**；争议倒计时**立即失效**；**冻结**该数据流，拒绝一切 Consumer 读取 |

**同一交易内必须：** 调用外部仲裁合约的 `requestArbitration`（见 §3.3.2）。

---

### 3.3 仲裁与纠纷解决（Arbitration & Dispute Resolution）

无仲裁模块则乐观预言机缺少「最高法院」，博弈闭环无法完成。

#### 3.3.1 核心状态机

争议触发后，状态严格按以下路径流转；**仲裁期间冻结所有外部数据提取**：

```text
[Null]
   └── proposeData ──> [Proposed]
                            ├── (Dispute_Window 结束, 无挑战) ──> finalize ──> [Finalized]
                            └── disputeData ──> [In_Arbitration]
                                                      ├── 仲裁回调 (可裁决) ──> [Finalized]
                                                      └── 仲裁回调 (无法裁决) ──> [Settled_As_Null]
```

72 小时仍无任何有效提议时，Feed 可进入 `[Settled_As_Null]`（见 §4.3），与仲裁熔断区分：前者为「无人提议」，后者为「规则/数据源无法判定」。

#### 3.3.2 可插拔仲裁接口（Arbitration Interface）

支持对接链下去中心化法院（**UMA DVM**）或生态内生多签/DAO 委员会。

**1. 外部仲裁请求（Outbound Call）**

- **触发时机：** `disputeData` 执行成功的**同一笔交易**内自动触发。  
- **接口示例：**

```solidity
IArbitrator(arbitratorAddress).requestArbitration(
    assertionId,
    dataIdentifier,
    proposedResult
);
```

**2. 仲裁结果回调（Inbound Callback）**

- **触发时机：** 仲裁网络完成投票/多签后，由**授权仲裁合约**异步回调。  
- **接口示例：**

```solidity
function callbackArbitrationResult(
    bytes32 assertionId,
    bool isProposerCorrect,
    string memory resolvedValue
) external onlyArbitrator;
```

- **权限：** 仅 `onlyArbitrator`；非授权地址调用必须 revert。  
- **同一区块内完成：** 押金清算（§3.3.4）+ 状态 → `Finalized`（或 `Settled_As_Null`）+ 写入最终 `resolvedValue`。

#### 3.3.3 终审裁判逻辑与异常处理

仲裁层在核对 IPFS/链上 `Ancillary_Data` 规则文本后，须返回以下三类结果之一：

| 裁决 | 条件 | 链上行为 |
| --- | --- | --- |
| **提议者胜诉** | `isProposerCorrect == true` | 采纳原 `proposedResult` → `Finalized` |
| **挑战者胜诉** | `isProposerCorrect == false` | 采纳仲裁返回的 `resolvedValue` → `Finalized` |
| **无法裁决** | 官方未发布、规则漏洞、数据源不可验证 | **熔断**：→ `Settled_As_Null`；**双方押金原路退回**，不作惩罚 |

#### 3.3.4 押金清算与利益分配（Slasher Math）

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

> **与 §4.2 的关系：** §4.2 定义押金**规模**（与 TVL 挂钩）；本节定义争议**清算分配**。实现上可采用简化模型（如败诉方 50% 归胜诉方、50% 归协议），但主网应对齐 $\gamma$ 与仲裁成本。

---

### 3.4 数据消费接口（Data Egress / Consumer Interface）

| 项 | 内容 |
| --- | --- |
| **功能** | 供 DeFi / 预测市场等合约只读获取已固化宏观数据 |
| **接口** | `getFinalizedData(bytes32 dataIdentifier) external view returns (string memory)` |
| **安全防线** | 状态非 `Finalized` 时必须 **revert**（含 `Proposed`、`In_Arbitration`） |

**X-Market 结算消费示例：** 固化后将 `resolvedValue` 写入 `MarketPool`（Poisson slot / Dirichlet bucket / Normal 数值），用户调用 `settlement::claim_position` 按实际结果赔付。

---

## 4. 关键安全与边界设计

### 4.1 数据修正案（The Revision Problem）

政府常于数月后发布修正值（Revision）。

- **原则：** 预言机只认**初值（First Release）**。  
- **落地：** `Ancillary_Data` 须写明：「仅以官方在指定发布日**首次公布**的数据为准，后续修正不追溯。」

### 4.2 经济学安全模型（Bond Sizing）

说谎成本须高于作恶收益（Profit from Corruption, PfC）：

$$Bond_{required} = \max(Minimum\_Bond,\; \alpha \times TVL_{dependent})$$

- $\alpha$：风险系数（如 0.05）。  
- $TVL_{dependent}$：依赖该数据标识符的链上总锁定价值（如关联 Pool 的 vault + 未 claim 头寸）。

### 4.3 数据源宕机或长期无提议（Fallback）

- **场景：** 发布日官网宕机，或无人提议。  
- **机制：** 自 `Event_Ts` 起 **72 小时**内仍无通过争议期的有效数据 → Feed → `Settled_As_Null`。  
- **下游：** 消费方合约按各自兜底条款退款或中止（X-Market 可扩展 LP/头寸退款路径）。

---

## 5. 数据状态字典（开发参考）

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

---

## 6. 接口汇总

| 阶段 | 函数 | 调用方 |
| --- | --- | --- |
| 注册 | `registerDataFeed(...)` | Admin |
| 提议 | `proposeData(dataIdentifier, proposedResult)` | Proposer |
| 争议 | `disputeData(assertionId)` | Disputer |
| 无争议结算 | `finalizeAssertion(assertionId)` | 任何人（窗口结束后） |
| 仲裁请求 | `IArbitrator.requestArbitration(...)` | 预言机合约（内部） |
| 仲裁回调 | `callbackArbitrationResult(...)` | 授权仲裁合约 |
| 熔断 | `nullifyFeed(dataIdentifier)` | 任何人（72h 无提议等） |
| 读取 | `getFinalizedData(dataIdentifier)` | 任意只读调用 |

---

## 7. 工程落地索引（X-Market）

| PRD 概念 | 当前实现（Testnet） |
| --- | --- |
| DataFeed 注册 | `macro_oracle::register_data_feed` |
| propose / dispute / finalize | `propose_data`, `dispute_assertion`, `finalize_assertion` |
| Admin 仲裁（简化 DVM） | `resolve_dispute(proposer_wins)` |
| 市场结算 | `finalize_*` → `market_pool::set_resolution` → `settlement::claim_position` |
| Admin 快路径 | `settlement_oracle::report_resolution`（联调备用） |
| 操作手册 | [docs/oracle-playbook.md](./docs/oracle-playbook.md) |

**待增强（相对本 PRD）：** 链上 `In_Arbitration` 与外部 UMA DVM 的 `requestArbitration` / `callbackArbitrationResult` 全自动对接；`Settled_As_Null` 争议熔断双退押金；$\gamma$ 抽成与 UMA 对齐。

---

## 8. 参考

- UMA Optimistic Oracle / DVM 争议与投票流程  
- [uma1.md](./uma1.md) — 仲裁状态机、Slasher Math、五态枚举  
- [uma2.md](./uma2.md) — 预言机术语标准化、Optimistic Engine、仲裁 Outbound/Inbound 规范  
