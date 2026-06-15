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

**English** | [简体中文](./mainnet-drill-record-template.zh.md)

# X-Market Sui Mainnet Launch Drill Record Template

> Purpose: Record execution evidence, results, and remediation items for each pre-mainnet drill.  
> Recommendation: Copy this template to a new file for each drill, e.g. `mainnet-drill-2026-06-01.md`.

---

## 0. Basic Information

- Drill name:
- Drill date:
- Drill environment (Testnet/Mainnet Shadow):
- Target version (commit):
- Lead:
- Participants:

---

## 1. Drill Scope

- [ ] A. Normal buy / settlement / claim closed loop
- [ ] B. Slash trigger and post-timelock recovery
- [ ] C. Slash multisig proposal → approval → execution
- [ ] D. ZK challenge → delayed finalization
- [ ] E. Frontend mainnet config and key page regression
- [ ] F. Alert pipeline and on-call response

Notes:

---

## 2. Pre-flight Checks

- [ ] `sui move build` succeeds
- [ ] `sui move test` all pass
- [ ] `Package ID` / `GlobalConfig` / `AdminCap` confirmed
- [ ] Risk parameter baseline confirmed (LP guard / slash / ZK)
- [ ] Drill wallets and test funds prepared

---

## 3. Execution Record (fill in step by step)

### 3.1 Step Checklist

| Step | Operation description | Transaction hash / object ID | Result (success/failure) | Notes |
| --- | --- | --- | --- | --- |
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

### 3.2 Key Assertions

- [ ] Transaction success rate meets expectations
- [ ] Fund and liability changes meet expectations
- [ ] `paused` state transitions meet expectations
- [ ] `SlashRecord` / `ZkVerification` events observable correctly
- [ ] Frontend display consistent with on-chain state

---

## 4. Incidents and Handling

| Time | Incident | Initial cause | Temporary mitigation | Final conclusion |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

---

## 5. Drill Conclusion

- Overall conclusion (pass / conditional pass / fail):
- Blockers (P0):
- High-priority issues (P1):
- Deferrable issues (P2):

---

## 6. Remediation Plan

| Issue | Priority | Owner | Deadline | Status |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

---

## 7. Review and Sign-off

- Protocol lead:
- Risk lead:
- Ops lead:
- Product lead:
- Final approval time:

---

## 8. Attachments

- Log links:
- Monitoring screenshots:
- Browser links:
- Related PR / commit:
