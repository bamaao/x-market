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

**English** | [简体中文](./mainnet-drill-2026-06-06.zh.md)

# X-Market Sui Pre-Mainnet Drill Record

## 0. Basic Information

- **Drill name:** P0.7 Testnet Emergency Drill
- **Drill date:** 2026-06-06
- **Environment:** Sui Testnet
- **Package ID:** `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e`
- **Execution wallet:** `0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07`
- **Automation script:** `app/scripts/p0-drills.ts`

## 1. Drill Scope

- [x] A. Buy position (settlement/claim pending maturity)
- [x] B. Slash trigger + paused verification (resume pending timelock)
- [x] C. SlashGovernance multisig propose → execute
- [x] D. ZK submit/verify (challenge requires separate wallet; finalize pending window)
- [ ] E. Frontend page manual regression
- [ ] F. Alert pipeline and on-call response

## 3. Execution Record

| Drill | Step | Result | Digest | Notes |
|------|------|------|--------|------|
| SETUP | merge USDC coins | success | njp6bH3QqX6qv5tEShQH3XGLqbuqJh6M7uMm7umKRvu |  |
| A | deposit_liquidity 50 USDC (buy prep) | success | D6T3GrTQaScRSYzDkAFqy1dygyUbaavQ1cpF8NMK2kgh |  |
| A | buy_poisson_digital k=7 0.01 USDC | success | GzYo8Shz5Sc7JU212TLsubR7Ydx6TQ3EUWp4LrMrN8yN |  |
| A | report_resolution + claim_position | skipped |  | Pool maturity is in the future; use settlement_oracle::report_resolution after expiry, then claim |
| B | deposit_liquidity 10 USDC (slash prep) | success | H79aq96MNkrrEXxALKa1JCUnBy9kFB2NhbnP7KfFU3q |  |
| B | slash_pool 1 USDC | success | 9xLZfHSrG1qbrTeUsDSrAKWqkKSCyvUG28eFGiNnW8mj |  |
| B | verify pool.paused | success | 9xLZfHSrG1qbrTeUsDSrAKWqkKSCyvUG28eFGiNnW8mj | paused=true |
| B | unslash_resume_pool | manual |  | Wait for slash timelock 1800s, then Admin calls unslash_resume_pool |
| SETUP | merge USDC coins | success | 2yHUfJzS11DedcVnx52hN3chma7BDaU8feGb5TrxVyzx |  |
| C | deposit_liquidity 5 USDC (gov prep) | success | Ervev8J7rbXZBWZL9BZYk898dAfKyDL49zr41uSCqfbb |  |
| C | init_slash_governance threshold=1 | success | HKki2pB9ScBdawhVuFW1ASxEQJ7JJ7Y3RVLcaNFJwSmL |  |
| C | propose_slash_request 0.5 USDC | success | CcXVAQxf9yox2FUjawY7QuwFyKPZCvMZgFfK5t8M8Vav |  |
| C | execute_slash_request (threshold=1) | success | 9zbRnu669BW5WQf3ScTfxLJtpNsjty9TVskmdxRLyg4i |  |
| D | submit_proof | success | FwjL1XQnfY8MVfyKLgSX81mvAPePwbHMMPG9VS5JDVkA |  |
| D | verify_proof accepted | success | 322hKSKstbsbrmHNQTG4TLHw7Ns1F31aS77o1LJcGmzV |  |
| D | challenge_verification | skipped |  | Verifier and challenger cannot be the same address (on-chain constraint); mainnet requires separate challenger wallet |
| D | finalize_verification | manual |  | Admin finalize after challenge window 3600s ends |

## 5. Drill Conclusion

- **Overall conclusion:** Passed (manual items pending completion)
- **Manual follow-ups:** B resume (1800s) · D finalize (3600s) · A claim (after maturity)

## 7. Review and Sign-off

Protocol / Risk / Ops / Product lead sign-off: Pending
