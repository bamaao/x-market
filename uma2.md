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

**English** | [简体中文](./uma2.zh.md)

Based on the pure positioning of the Macro Data Oracle, we need to replace prediction-market vocabulary (such as `marketId`, `proposeOutcome`) with more precise oracle terminology.

Below is the restructured and standardized PRD technical chapter:

---

### 3.3 Proposal & Dispute Mechanism (The Optimistic Engine)

This module is the core economic engine of the macro oracle, ensuring off-chain real macro data is stored on-chain correctly through a "bond game" mechanism.

#### 3.3.1 Data Proposal

* **Description:** Allows any off-chain node (proposer) to carry official data in plaintext onto chain after a real-world macro event occurs.
* **Method signature:** `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)`
* **Core logic & prerequisites:**
* **Prerequisites:** The caller (Proposer) must transfer to the contract an amount equal to `Proposer_Bond_Size` of the system native token (e.g. USDC) as an honesty bond.
* **State check:** The macro indicator identifier (`dataIdentifier`) must currently be in `Null` state, and the off-chain official event must have reached its publication time.
* **Result:** The contract generates a unique proposal hash `assertionId`, changes data state from `Null` to `Proposed`, and starts the `Dispute_Window` countdown.



#### 3.3.2 Data Dispute

* **Description:** Allows any off-chain observer (disputer) to on-chain reject a fraudulent or incorrect proposal during the dispute window.
* **Method signature:** `disputeData(bytes32 assertionId) external`
* **Core logic & prerequisites:**
* **Prerequisites:** The caller (Disputer) must transfer to the contract an amount equal to `Disputer_Bond_Size` of the native token as a challenge bond.
* **Timing check:** Must be triggered before the proposal's `Dispute_Window` countdown ends.
* **State change:** Once successfully triggered, the proposal's on-chain state **immediately changes from `Proposed` to `In_Arbitration`**, the original countdown is forcibly paused and invalidated. The system automatically locks the data stream and rejects all external DeFi business contract consumption calls.



---

### 3.4 Arbitration Layer Integration (Arbitration Interface)

#### 3.4.1 Requirements

When data state becomes `In_Arbitration`, the proposer and disputer disagree and the system's own optimistic countdown cannot resolve the conflict. The oracle contract must bridge the conflict's data context to the supreme arbitration court (pluggable external adjudication layer) via a standardized interface and request a final ruling.

#### 3.4.2 Technical Integration Specification

##### 1. Outbound Arbitration Request

* **Trigger timing:** Automatically triggered within the same block transaction as a successful `disputeData` execution.
* **Call logic:** The oracle contract sends a ruling request to the designated decentralized arbitration network (e.g. UMA's DVM protocol, or a custom validator committee contract), passing core context:
```solidity
// Appeal to external arbitration court
IArbitrator(arbitratorAddress).requestArbitration(
    assertionId, 
    dataIdentifier, 
    proposedResult
);

```



```

##### 2. Inbound Arbitration Callback
*   **Trigger timing:** After the off-chain arbitration network completes voting consensus or multisig ruling, the arbitration court contract asynchronously calls this contract one-way.
*   **Method signature:** `callbackSettlement(bytes32 assertionId, string memory finalResult) external`
*   **Access control:** Must enforce `onlyArbitrator` modifier; reject malicious calls from any unauthorized address.
*   **Follow-up execution:**
    *   Contract receives `finalResult` (true macro data) ruled by the supreme court.
    *   Based on `finalResult`, determine winner/loser and automatically execute **bond settlement and reward distribution** defined in section 3.4.4 within the same block.
    *   Change the macro data state to `Finalized` and permanently open read-only access to all other smart contracts on the network.

```
