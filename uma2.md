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

根据宏观数据源预言机（Macro Data Oracle）的纯正定位，我们需要将原来带有预测市场（Prediction Market）色彩的词汇（如 `marketId`、`proposeOutcome`）修正为更加精准的预言机元组。

以下是重新梳理并标准化后的 PRD 核心技术章节：

---

### 3.3 提议与争议机制（The Optimistic Engine）

该模块是宏观预言机的核心经济学引擎，通过“质押博弈”机制确保链下真实的宏观数据能够无误地暂存至链上。

#### 3.3.1 数据提议功能 (Data Proposal)

* **功能描述：** 允许任何链下节点（提议者）在现实世界宏观事件发生后，将官方数据明文搬运上链。
* **方法签名：** `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)`
* **核心逻辑与调用前提：**
* **前提条件：** 调用者（Proposer）的账户必须向合约转入数量等于 `Proposer_Bond_Size` 的系统本位币（如 USDC）作为诚信押金。
* **状态校验：** 该宏观指标标识符（`dataIdentifier`）当前必须处于 `Null` 状态，且链下官方事件已到发布时间点。
* **执行结果：** 合约生成唯一的提议哈希 `assertionId`，将数据状态由 `Null` 变更为 `Proposed`，并启动 `Dispute_Window` 争议期倒计时。



#### 3.3.2 争议与挑战功能 (Data Dispute)

* **功能描述：** 允许任何链下观察者（挑战者）在争议期内，对作假或有误的提议数据进行链上驳回。
* **方法签名：** `disputeData(bytes32 assertionId) external`
* **核心逻辑与调用前提：**
* **前提条件：** 调用者（Disputer）必须向合约转入数量等于 `Diser_Bond_Size` 的本位币作为挑战押金。
* **时效校验：** 必须在该提议的 `Dispute_Window` 倒计时结束之前触发。
* **状态变更：** 一旦该函数被成功触发，该提议的链上状态**立即由 `Proposed` 变更为 `In_Arbitration`（仲裁中）**，同时原有的倒计时强行暂停并失效。系统自动锁定该数据流，拒绝一切外部 DeFi 业务合约的消费调用。



---

### 3.4 仲裁层对接模块（Arbitration Interface）

#### 3.4.1 需求描述

当数据状态变为 `In_Arbitration` 时，意味着提议者与挑战者双方各执一词，系统自身的乐观倒计时已无法解决冲突。预言机合约必须通过标准化接口，将冲突事件的数据上下文桥接至最高仲裁法庭（可插拔的外部裁判层），请求终审裁决。

#### 3.4.2 技术对接规范

##### 1. 外部仲裁请求（Outbound Call）

* **触发时机：** 在 `disputeData` 函数执行成功的同一个区块事务（Transaction）中自动触发。
* **调用逻辑：** 预言机合约向指定的去中心化仲裁网络（如 UMA 的 DVM 协议、或自定义的验证者委员会合约）发起裁判请求，传入核心上下文：
```solidity
// 向外部仲裁法庭申诉
IArbitrator(arbitratorAddress).requestArbitration(
    assertionId, 
    dataIdentifier, 
    proposedResult
);

```



```

##### 2. 仲裁结果回调（Inbound Callback）
*   **触发时机：** 链下仲裁网络完成投票共识或多签裁决后，由仲裁法庭合约单向异步调用本合约。
*   **方法签名：** `callbackSettlement(bytes32 assertionId, string memory finalResult) external`
*   **权限控制：** 必须强制带有 `onlyArbitrator` 修饰器，拒绝任何非授权地址的恶意调用。
*   **后续执行逻辑：**
    *   合约接收到由最高法院裁定的 `finalResult`（真实的宏观数据）。
    *   根据 `finalResult` 判定胜负手，在同一个区块内自动执行 3.4.4 章节定义的**押金清算与奖励瓜分**。
    *   将该宏观数据的状态正式修改为 `Finalized`（已固化），并永久开放给全网其他智能合约进行只读调用。

```