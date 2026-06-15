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

**简体中文** | [English](./uma1.md)

乐观预言机（Optimistic Oracle）要是没有“仲裁”模块，就像司法系统没有最高法院，整个经济博弈的闭环就断了——谁来判定提议者和挑战者到底谁在说谎？

这就把核心的“3.4 仲裁与纠纷解决模块”补进 PRD 中，并把相关的状态机和利益分配逻辑梳理清楚。

---

### 新增模块：3.4 仲裁与纠纷解决模块 (Arbitration & Dispute Resolution)

#### 3.4.1 核心状态机演变 (State Machine)

一旦数据标识符被触发争议，其链上状态必须严格按照以下路径流转，并在仲裁期间**冻结所有外部数据提取请求**：

```
[Proposed] ──(触发 disputeAssertion)──> [In_Arbitration] ──(仲裁委员会/DVM裁决)──> [Finalized] (数据固化)

```

#### 3.4.2 仲裁路由与接口设计 (Arbitration Interface)

本预言机采用**可插拔式仲裁架构**，既支持对接链下成熟的去中心化法院（如 UMA 的 DVM），也支持对接生态内生自理的多签/DAO 委员会。

* **向仲裁层发起请求（Outbound Call）：**
当争议触发时，预言机合约必须自动调用外接仲裁合约的创建纠纷接口：
`function requestArbitration(bytes32 assertionId, bytes32 dataIdentifier, string memory claimedValue) external;`
* **接收仲裁结果回调（Inbound Callback）：**
仅限经过授权的仲裁合约地址（`onlyArbitrator`）可以调用此方法来返回最终判决：
`function callbackArbitrationResult(bytes32 assertionId, bool isProposerCorrect, string memory resolvedValue) external;`

#### 3.4.3 终审裁判逻辑与异常处理

仲裁网络（链下投票或多签）在核对 IPFS 规则文本后，必须返回以下三种裁决结果之一：

1. **提议者胜诉 (`isProposerCorrect == true`)**：判定挑战者为恶意碰瓷。提议者提交的 `claimedValue` 立即被认定为真，状态变更为 `Finalized`。
2. **挑战者胜诉 (`isProposerCorrect == false`)**：判定提议者说谎或数据有误。仲裁网络返回真实的宏观数据 `resolvedValue`，状态变更为 `Finalized`。
3. **无法裁决 (Unresolvable / Bad Rule)**：若因现实中官方数据源由于特殊原因未发布，或链下规则本身存在严重漏洞导致无法判定对错。系统触发**熔断逻辑**：将数据状态变更为 `Settled_As_Null`，将双方押金原路退回，不作惩罚。

#### 3.4.4 押金清算与利益分配数学模型 (Slasher Math)

这是驱动整个乐观预言机不作恶的经济学引擎。当仲裁结果落地后，智能合约必须在同一个区块内自动执行清算。

设提议者押金为 $B_p$，挑战者押金为 $B_c$，仲裁协议抽成比例为 $\gamma$（如 20%）：

* **若提议者胜诉：**
* 提议者赎回本金，并获得挑战者的绝大部分押金作为奖励：

$$\text{提议者总所得} = B_p + B_c \times (1 - \gamma)$$


* 仲裁网络/国库获得抽成：

$$\text{仲裁协议收入} = B_c \times \gamma$$


* 挑战者资产被清算：$0$


* **若挑战者胜诉：**
* 挑战者赎回本金，并获得提议者的绝大部分押金作为奖励：

$$\text{挑战者总所得} = B_c + B_p \times (1 - \gamma)$$


* 仲裁网络/国库获得抽成：

$$\text{仲裁协议收入} = B_p \times \gamma$$


* 提议者资产被清算：$0$



---

### 5. 补充：数据状态字典（供开发参考）

为了配合仲裁模块，合约全局变量必须支持以下五种状态：

```solidity
enum AssertionState {
    Null,            // 尚未有人提议
    Proposed,        // 已有人提议，正处于争议倒计时窗口
    In_Arbitration,  // 被人挑战，正交由最高法院仲裁中（此状态下拒绝任何 Consumer 调用）
    Finalized,       // 判定结束，数据已固化，可安全对外输出
    Settled_As_Null  // 规则或数据源异常，市场熔断作废
}

```

这样一来，“提议、挑战、仲裁、清算”这四个阶段就完全闭环了。在宏观数据源的实际工程落地中，仲裁层通常会给投票者留出 2-3 天的链下取证和投票时间，所以处于 `In_Arbitration` 状态的数据会有一定的延迟，外部消费端合约读取时必须做好 `revert` 的异步处理对接。
