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

**English** | [简体中文](./uma1.zh.md)

Without an "arbitration" module, an Optimistic Oracle is like a judicial system without a supreme court — who decides whether the proposer or the disputer is lying?

This adds the core "3.4 Arbitration & Dispute Resolution" module to the PRD and clarifies the related state machine and incentive distribution logic.

---

### New Module: 3.4 Arbitration & Dispute Resolution

#### 3.4.1 Core State Machine

Once a data identifier is disputed, its on-chain state must follow this path strictly, and **all external data reads must be frozen during arbitration**:

```
[Proposed] ──(trigger disputeAssertion)──> [In_Arbitration] ──(Arbitration Committee/DVM ruling)──> [Finalized] (data finalized)

```

#### 3.4.2 Arbitration Routing & Interface Design

This oracle uses a **pluggable arbitration architecture**, supporting both mature off-chain decentralized courts (such as UMA's DVM) and ecosystem-native multisig/DAO committees.

* **Outbound request to the arbitration layer:**
When a dispute is triggered, the oracle contract must automatically call the external arbitrator's case-creation interface:
`function requestArbitration(bytes32 assertionId, bytes32 dataIdentifier, string memory claimedValue) external;`
* **Inbound callback for arbitration results:**
Only authorized arbitrator contract addresses (`onlyArbitrator`) may call this method to return the final verdict:
`function callbackArbitrationResult(bytes32 assertionId, bool isProposerCorrect, string memory resolvedValue) external;`

#### 3.4.3 Final Verdict Logic & Exception Handling

After reviewing IPFS rule text, the arbitration network (off-chain voting or multisig) must return one of three outcomes:

1. **Proposer wins (`isProposerCorrect == true`)**: The challenger is deemed malicious. The proposer's `claimedValue` is immediately accepted as truth; state becomes `Finalized`.
2. **Disputer wins (`isProposerCorrect == false`)**: The proposer is deemed dishonest or the data is wrong. The arbitration network returns the true macro data `resolvedValue`; state becomes `Finalized`.
3. **Unresolvable / Bad Rule**: If the official data source did not publish due to special circumstances, or on-chain rules have serious flaws making a verdict impossible. **Circuit breaker**: state becomes `Settled_As_Null`; both parties' bonds are refunded with no penalty.

#### 3.4.4 Bond Settlement & Incentive Distribution (Slasher Math)

This is the economic engine that keeps the optimistic oracle honest. When an arbitration result is finalized, the smart contract must automatically settle within the same block.

Let proposer bond be $B_p$, disputer bond be $B_c$, and arbitration protocol fee ratio be $\gamma$ (e.g. 20%):

* **If proposer wins:**
* Proposer recovers principal and receives most of the challenger's bond as reward:

$$\text{Proposer total} = B_p + B_c \times (1 - \gamma)$$


* Arbitration network/treasury receives fee:

$$\text{Arbitration protocol income} = B_c \times \gamma$$


* Challenger assets liquidated: $0$


* **If disputer wins:**
* Disputer recovers principal and receives most of the proposer's bond as reward:

$$\text{Disputer total} = B_c + B_p \times (1 - \gamma)$$


* Arbitration network/treasury receives fee:

$$\text{Arbitration protocol income} = B_p \times \gamma$$


* Proposer assets liquidated: $0$



---

### 5. Supplement: Data State Dictionary (for development reference)

To support the arbitration module, contract global state must support these five states:

```solidity
enum AssertionState {
    Null,            // No proposal yet
    Proposed,        // Proposed; dispute countdown window active
    In_Arbitration,  // Challenged; supreme court arbitrating (Consumer calls rejected in this state)
    Finalized,       // Verdict complete; data finalized; safe for external output
    Settled_As_Null  // Rule or data source anomaly; market circuit-broken
}

```

With this, the four stages — "propose, challenge, arbitrate, settle" — form a complete loop. In production macro data oracle engineering, the arbitration layer typically allows voters 2–3 days for off-chain evidence gathering and voting, so data in `In_Arbitration` will have some delay; external consumer contracts must handle async `revert` when reading.
