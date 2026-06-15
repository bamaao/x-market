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

# PRD — SuiProphet Network

**English** | [简体中文](./SuiProphet_Network.zh.md)

## 1. Project Overview & Vision

**SuiProphet Network** is a decentralized prediction market platform with a paid-knowledge ecosystem, built on the Sui blockchain.
Traditional prediction markets stop at "betting on outcomes" and lack tamper-proof track records for professional information producers (KOLs/prophets).

SuiProphet uses fully on-chain data (Sui), Indexer/IPFS persistent blobs, and native privacy key management (Seal) to build a closed loop of "pay-before to see instantly, mandatory public audit after, fully on-chain true track record". The platform filters fake signal providers, surfaces genuine "oracle prophets", and monetizes Web3 knowledge assets via efficient gas-free stablecoin payments.

---

## 2. User Roles & Core Value

| User role | Core behavior | Core value / incentive |
| --- | --- | --- |
| **Prophet** | Create public/private predictions, set unlock price, write exclusive deep analysis. | Tamper-proof authoritative on-chain win-rate backing; earn high unlock revenue from private predictions. |
| **Subscriber (Buyer)** | Browse on-chain leaderboard, pay stablecoin to instantly unlock high-win-rate prophet predictions. | High-quality Alpha investment reference; follow top prophets for better returns. |
| **Protocol** | Maintain prediction market infrastructure, integrate oracle, drive fully automated settlement via Crank. | Fixed percentage of each private prediction unlock fee as treasury revenue. |

---

## 3. Core Technical Architecture & Data Flow

This project abandons traditional cross-chain privacy schemes in favor of **Sui + Indexer/IPFS + Seal**, ensuring extreme parallel performance and seamless on-chain state verification.

### 3.1 Seal Dual OR Access Control Strategy

This is the core of "pay-before to see, public after for all". Prophet-published ciphertext is hosted on Indexer (`idx:`) or IPFS (`ipfs:`); decryption keys are managed by Seal node clusters. Seal nodes execute the following **dual OR policy** based on Sui on-chain state:

* **Condition A (pre-event paid flow):** The wallet requesting decryption exists in the prediction object's `paid_buyers` list.
* **OR**
* **Condition B (post-event public flow):** Current Sui on-chain time exceeds event deadline ($\text{Current Time} > \text{Lock Time}$), or event state `is_ended == true`.

---

## 4. Functional Module Requirements

### 4.1 Prediction Market & Event Creation

* **Base framework:** Any user can launch a standard structured prediction market (e.g. Option A = up, Option B = down).
* **Core parameters:** Each prediction market appears on Sui as an independent `Object` containing: market ID, lock deadline (`lock_time`), oracle data source (e.g. Pyth/Stork), current status.

### 4.2 Prophet Tier & Paid Unlock Eligibility (PRD §11.3.7)

New prophets must first accumulate on-chain track record via **`unlock_price = 0` free practice predictions**, then may enable paid unlock after Oracle audit:

| Condition | Threshold |
| --- | --- |
| Audited rounds | ≥ 3 |
| Prophet Score | ≥ 40 / 100 |
| Cheat record | 0 |

On-chain `commit_private_prophecy` enforces gate when `unlock_price > 0`; frontend cannot bypass.

### 4.3 Private Prediction Publishing (Prophet side)

* **Structured input:** When publishing, frontend wraps into standard JSON:
```json
{
  "market_id": "0x6a83...sui_object",
  "predicted_option": "A", 
  "analysis_content": "Based on on-chain whale chip concentration analysis..." 
}

```




```
*   **Encrypt & upload:** Frontend threshold-encrypts JSON via Seal master public key, uploads ciphertext to **Indexer** (`POST /v1/prophecies/blob`), obtains `blob_id` (`idx:…` or `ipfs:…`).
*   **On-chain commit:** Prophet calls Move contract, creates "private prediction" child object, submits `blob_id`, **`Hash(JSON_Plaintext)`**, unlock unit price (e.g. 10 USDC), and `lock_time`.

### 4.4 Instant Paid Unlock (Subscriber side)
*   **Pay to see:** Subscriber browses prophet profile on frontend, clicks "Unlock".
*   **On-chain interaction:** Call Move contract, transfer corresponding stablecoin (USDC/AUSD) to contract escrow. Contract writes user wallet address into prediction object's `paid_buyers` vector.
*   **Conditional decrypt:** Frontend signs request to Seal nodes. Seal verifies address in `paid_buyers` (**Condition A**), releases key. Frontend downloads ciphertext from Indexer/IPFS and decrypts locally — **user instantly gets prediction option and analysis**.

### 4.5 Post-Event Automatic Audit & Settlement
When real-world result occurs (e.g. time reaches `lock_time`), fully automated audit runs without prophet manual intervention:


```

[Event expires] ──> [Oracle records true result]
│
▼
[Platform Keeper / anyone triggers settlement call]
│
▼
[Seal detects Current Time > Lock Time (Condition B)] ──> [Public decryption key]
│
▼
[Contract verifies: Hash(decrypted plaintext) == on-chain reserved Hash]
│
├─> [Match success] ──> Smart compare result ──> Write true record (win/loss)
└─> [Match fail/data tampered] ──> Mark cheat ──> Deduct score
│
▼
[Funds unfreeze] ──> Protocol fee X% ──> Remainder to prophet ──> Prediction becomes Public for all

```

### 4.6 Prophet On-Chain Leaderboard System
Platform smart contract dynamically maintains global prophet leaderboard based on each auto-audited win/loss.
*   **Metrics:** Total predictions, composite win rate, current streak, historical max streak, cumulative subscriber ROI.
*   **Anti-spam algorithm:** Multi-dimensional weighted score; log function dampens weight from pure volume farming:

$$\text{Prophet Score} = w_1 \cdot \text{Accuracy Rate} + w_2 \cdot \log(N) + w_3 \cdot \text{ROI}$$

> *Where $\text{Accuracy Rate}$ is win rate, $N$ is total valid prediction rounds, $w_1, w_2, w_3$ are global system weights.*

Leaderboard data uses on-chain `ProphetStats` as sole source of truth; MVP needs no local stats service; production may optionally use Indexer for cache acceleration.

### 4.7 Premium UX (Gas Station Sponsored Transactions)
*   For pure stablecoin smooth interaction, platform fully integrates Sui **Sponsored Transactions**.
*   Whether "publish prediction" or "paid unlock", wallet popup **only shows stablecoin debit/transfer**.
*   Platform Gas Station node (Gas Payer) automatically covers tiny SUI gas for all compliant interactions backend, lowering Web2 user onboarding barrier.

---

## 5. Key UX Flows


```

【Prophet publish flow】
Enter prediction & exclusive analysis ──> Frontend Seal encrypt ──> Upload Indexer blob ──> Wallet sign (gas-free) ──> On-chain Commit success

【Buyer pre-event unlock flow】
Browse win-rate board ──> Click unlock ──> Wallet sign pay stablecoin (gas-free) ──> Seal condition pass ──> Frontend decrypt & read instantly

【Post-event auto audit flow】
Oracle records result ──> On-chain triggers settlement ──> Extract prediction plaintext ──> In-contract Hash verify ──> Update leaderboard ──> Free public for all

```

---

## 6. Non-Functional Requirements & Security
*   **Absolute content tamper-proofing:** Since `Hash(JSON_Plaintext)` is locked on-chain beforehand, prophet or platform nodes cannot modify decrypted plaintext post-hoc to fake "oracle predictions", eliminating classic internet signal-provider "delete post / change record" abuse.
*   **Time window overflow protection:** Once on-chain time is within 5 minutes of `lock_time`, contract permanently closes paid channel for that prediction (`paid_buyers` writes stop), preventing malicious purchase or arbitrage when real-world result is already clear.
