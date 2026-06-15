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

# PRD: Macro Data Optimistic Oracle

**English** | [简体中文](./Macro_Data_Oracle.zh.md)

## 0. Positioning

The **Macro Data Oracle** core mission is to provide authentic, tamper-proof macroeconomic indicators (such as GDP, CPI, etc.) to the on-chain ecosystem. It **does not** need a prediction-market-style Commitment / betting phase; its role is an on-chain "data carrier and notary" — consumed read-only by DeFi, insurance, **prediction market settlement**, and other smart contracts.

This document uniformly uses oracle terminology (`dataIdentifier`, `proposedResult`, `assertionId`), avoiding prediction-market vocabulary (such as `marketId`, `proposeOutcome`).

---

## 1. Document Overview

| Item | Description |
| --- | --- |
| **Product positioning** | On-chain macro/financial data source based on optimistic game theory |
| **Core goal** | Allow any off-chain node to carry officially published macro data on-chain; ensure authenticity via staking and challenges; open to all contracts after finalization |
| **Four-stage closed loop** | Propose → Challenge → **Arbitrate** → Settle (all four required; without arbitration the economic game cannot close) |

---

## 2. Core Business Flow

The on-chain data lifecycle is driven by real-world publication events and on-chain time windows:

```
Event occurs → Propose result → Dispute window → [Optional] Arbitration → Final settlement & consumption
```

1. **Event Occurrence**  
   Official agencies (e.g. U.S. Bureau of Labor Statistics BLS, national statistics bureaus) officially publish macro indicators at scheduled times.

2. **Propose Result**  
   Off-chain nodes (Proposer) read official data, call the contract to write plaintext results (e.g. `CPI = 2.8%`), and **stake Proposer Bond**.

3. **Dispute Window**  
   Countdown begins (typically 24 hours). Network observers cross-check against official sources.  
   - **No opposition:** Countdown ends → dispute-free finalize → data finalized.  
   - **Fraud/error found:** Challenger stakes **Disputer Bond** → state enters **In_Arbitration** → handed to external arbitration layer (UMA DVM, multisig/DAO committee, etc.).

4. **Final Settlement & Consumption**  
   - After dispute-free finalize or arbitration completion: state → `Finalized`.  
   - Winner recovers bond and receives reward; loser's bond forfeited per rules.  
   - External contracts safely read finalized data via read-only interface.

> **Arbitration delay note:** Off-chain arbitration (e.g. UMA DVM voting) typically requires 2–3 days for evidence and voting. Data is not consumable during `In_Arbitration`; downstream contracts must handle async/retry on `revert`.

---

## 3. Functional Requirements

### 3.1 Macro Indicator Definition & Registration (Data Identifier Registry)

To prevent ambiguity about the same indicator, each macro data series must be standardized on-chain.

**Registration elements:**

| Field | Description |
| --- | --- |
| `Data_Identifier` | Unique ID (e.g. `US_CPI_2026_M05`) |
| `Ancillary_Data` | Authoritative URL (e.g. `bls.gov`), precise definition (e.g. "unadjusted CPI YoY"), **first-release principle** (see §4.1) |
| `Liveness_Period` | Dispute window duration (seconds) |
| `Bond_Required` | Minimum propose/challenge bond (may tie to TVL, see §4.2) |
| `Event_Ts` | Earliest on-chain time official data may be proposed (typically ≥ linked contract/market maturity) |
| `Linked_Consumer` | Optional: bound consumer object ID (e.g. X-Market `MarketPool`) |

---

### 3.2 Proposal & Dispute Mechanism (The Optimistic Engine)

The optimistic oracle's economic engine: staking game temporarily stores off-chain real data on-chain.

#### 3.2.1 Data Proposal

| Item | Content |
| --- | --- |
| **Function** | After macro event, Proposer carries official data in plaintext on-chain |
| **Interface** | `proposeData(bytes32 dataIdentifier, string memory proposedResult) external returns (bytes32 assertionId)` |
| **Prerequisites** | Transfer ≥ `Proposer_Bond_Size` native token (e.g. USDC); `dataIdentifier` in proposable state (see §5 state machine); on-chain time ≥ `Event_Ts` |
| **Result** | Generates `assertionId`; Feed/Assertion state → `Proposed`; starts `Dispute_Window` |

**Core validation:**

1. No active Assertion for this identifier; Feed not `Finalized` / not `Settled_As_Null`.  
2. Deduct bond and lock in Assertion object.  
3. Record `proposed_at`, compute `liveness_end_at = proposed_at + Liveness_Period`.

#### 3.2.2 Data Dispute

| Item | Content |
| --- | --- |
| **Function** | During dispute window, observers on-chain reject fraudulent or incorrect proposals |
| **Interface** | `disputeData(bytes32 assertionId) external` (equivalent: `disputeAssertion`) |
| **Prerequisites** | Transfer ≥ `Disputer_Bond_Size` native token (typically ≥ Proposer Bond); current time ≤ `liveness_end_at` |
| **State change** | `Proposed` → **`In_Arbitration`**; dispute countdown **immediately invalidated**; **freeze** data stream, reject all Consumer reads |

**Same transaction must:** Call external arbitrator's `requestArbitration` (see §3.3.2).

---

### 3.3 Arbitration & Dispute Resolution

Without an arbitration module, the optimistic oracle lacks a "supreme court" and the game loop cannot complete.

#### 3.3.1 Core State Machine

After dispute trigger, state must follow this path strictly; **all external data extraction frozen during arbitration**:

```text
[Null]
   └── proposeData ──> [Proposed]
                            ├── (Dispute_Window ends, no challenge) ──> finalize ──> [Finalized]
                            └── disputeData ──> [In_Arbitration]
                                                      ├── Arbitration callback (rulable) ──> [Finalized]
                                                      └── Arbitration callback (unrulable) ──> [Settled_As_Null]
```

If no valid proposal within 72 hours, Feed may enter `[Settled_As_Null]` (see §4.3), distinct from arbitration circuit breaker: former is "no proposal", latter is "rules/data source cannot be determined".

#### 3.3.2 Pluggable Arbitration Interface

Supports off-chain decentralized courts (**UMA DVM**) or ecosystem-native multisig/DAO committees.

**1. Outbound Arbitration Request**

- **Trigger timing:** Automatically within the **same transaction** as successful `disputeData`.  
- **Interface example:**

```solidity
IArbitrator(arbitratorAddress).requestArbitration(
    assertionId,
    dataIdentifier,
    proposedResult
);
```

**2. Inbound Arbitration Callback**

- **Trigger timing:** After arbitration network completes voting/multisig, **authorized arbitrator contract** asynchronously callbacks.  
- **Interface example:**

```solidity
function callbackArbitrationResult(
    bytes32 assertionId,
    bool isProposerCorrect,
    string memory resolvedValue
) external onlyArbitrator;
```

- **Access control:** `onlyArbitrator` only; unauthorized calls must revert.  
- **Same block completion:** Bond settlement (§3.3.4) + state → `Finalized` (or `Settled_As_Null`) + write final `resolvedValue`.

#### 3.3.3 Final Verdict Logic & Exception Handling

After reviewing IPFS/on-chain `Ancillary_Data` rule text, arbitration must return one of three outcomes:

| Verdict | Condition | On-chain behavior |
| --- | --- | --- |
| **Proposer wins** | `isProposerCorrect == true` | Accept original `proposedResult` → `Finalized` |
| **Disputer wins** | `isProposerCorrect == false` | Accept arbitration `resolvedValue` → `Finalized` |
| **Unresolvable** | Official not published, rule gap, data source unverifiable | **Circuit breaker**: → `Settled_As_Null`; **both bonds refunded**, no penalty |

#### 3.3.4 Bond Settlement & Distribution (Slasher Math)

After arbitration result lands, contract must automatically settle **within the same block**.

Let proposer bond $B_p$, disputer bond $B_c$, arbitration protocol fee $\gamma$ (e.g. 20%).

**Proposer wins:**

$$\text{Proposer total} = B_p + B_c \times (1 - \gamma)$$

$$\text{Arbitration protocol/treasury income} = B_c \times \gamma$$

Disputer receives: $0$.

**Disputer wins:**

$$\text{Disputer total} = B_c + B_p \times (1 - \gamma)$$

$$\text{Arbitration protocol/treasury income} = B_p \times \gamma$$

Proposer receives: $0$.

**Dispute-free finalize (no arbitration):** Proposer fully recovers $B_p$; no forfeiture.

**Unresolvable (Settled_As_Null):** $B_p$, $B_c$ refunded in full.

> **Relation to §4.2:** §4.2 defines bond **size** (TVL-linked); this section defines dispute **settlement distribution**. Implementation may use simplified model (e.g. loser 50% to winner, 50% to protocol), but mainnet should align $\gamma$ with arbitration cost.

---

### 3.4 Data Consumption Interface (Data Egress / Consumer Interface)

| Item | Content |
| --- | --- |
| **Function** | DeFi / prediction markets etc. read finalized macro data |
| **Interface** | `getFinalizedData(bytes32 dataIdentifier) external view returns (string memory)` |
| **Safety guard** | Must **revert** when state is not `Finalized` (including `Proposed`, `In_Arbitration`) |

**X-Market settlement example:** After finalization, write `resolvedValue` to `MarketPool` (Poisson slot / Dirichlet bucket / Normal value); users call `settlement::claim_position` for payout per actual result.

---

## 4. Key Security & Boundary Design

### 4.1 Data Revisions (The Revision Problem)

Governments often publish revisions months later.

- **Principle:** Oracle recognizes **first release only**.  
- **Implementation:** `Ancillary_Data` must state: "Only the official **first publication** on the specified release date counts; subsequent revisions are not retroactive."

### 4.2 Economic Security Model (Bond Sizing)

Cost of lying must exceed profit from corruption (PfC):

$$Bond_{required} = \max(Minimum\_Bond,\; \alpha \times TVL_{dependent})$$

- $\alpha$: risk coefficient (e.g. 0.05).  
- $TVL_{dependent}$: total on-chain value depending on this data identifier (e.g. linked Pool vault + unclaimed positions).

### 4.3 Data Source Outage or Long No-Proposal (Fallback)

- **Scenario:** Official site down on release day, or no one proposes.  
- **Mechanism:** Within **72 hours** from `Event_Ts` with no valid data passing dispute period → Feed → `Settled_As_Null`.  
- **Downstream:** Consumer contracts refund or abort per fallback terms (X-Market may extend LP/position refund path).

---

## 5. Data State Dictionary (development reference)

Assertion / Feed must support these states (names may map to Move `u8` constants):

```solidity
enum AssertionState {
    Null,            // No proposal yet
    Proposed,        // Proposed; dispute countdown active
    In_Arbitration,  // Challenged; arbitrating (Consumer reads forbidden)
    Finalized,       // Verdict complete; data finalized; external output allowed
    Settled_As_Null  // Rule/data source anomaly or long no-proposal; circuit-broken
}
```

| State | Consumer `getFinalizedData` | Notes |
| --- | --- | --- |
| `Null` | revert | Awaiting proposal |
| `Proposed` | revert | Within dispute window |
| `In_Arbitration` | revert | Awaiting arbitration callback |
| `Finalized` | Returns finalized value | Only readable state |
| `Settled_As_Null` | revert | Business layer uses fallback logic |

---

## 6. Interface Summary

| Stage | Function | Caller |
| --- | --- | --- |
| Register | `registerDataFeed(...)` | Admin |
| Propose | `proposeData(dataIdentifier, proposedResult)` | Proposer |
| Dispute | `disputeData(assertionId)` | Disputer |
| Dispute-free settle | `finalizeAssertion(assertionId)` | Anyone (after window) |
| Arbitration request | `IArbitrator.requestArbitration(...)` | Oracle contract (internal) |
| Arbitration callback | `callbackArbitrationResult(...)` | Authorized arbitrator |
| Circuit breaker | `nullifyFeed(dataIdentifier)` | Anyone (72h no proposal, etc.) |
| Read | `getFinalizedData(dataIdentifier)` | Any read-only call |

---

## 7. Engineering Index (X-Market)

| PRD concept | Current implementation (Testnet) |
| --- | --- |
| DataFeed registration | `macro_oracle::register_data_feed` |
| propose / dispute / finalize | `propose_data`, `dispute_assertion`, `finalize_assertion` |
| Admin arbitration (simplified DVM) | `resolve_dispute(proposer_wins)` |
| Market settlement | `finalize_*` → `market_pool::set_resolution` → `settlement::claim_position` |
| Admin fast path | `settlement_oracle::report_resolution` (integration fallback) |
| Operations playbook | [docs/oracle-playbook.md](./docs/oracle-playbook.md) |

**Enhancements pending (relative to this PRD):** Full on-chain `In_Arbitration` with external UMA DVM `requestArbitration` / `callbackArbitrationResult` auto-integration; `Settled_As_Null` dispute circuit breaker dual bond refund; $\gamma$ fee aligned with UMA.

---

## 8. References

- UMA Optimistic Oracle / DVM dispute and voting flow  
- [uma1.md](./uma1.md) — Arbitration state machine, Slasher Math, five-state enum  
- [uma2.md](./uma2.md) — Oracle terminology standardization, Optimistic Engine, arbitration Outbound/Inbound spec  
