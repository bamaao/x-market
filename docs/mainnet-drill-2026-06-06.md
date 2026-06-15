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

# X-Market Sui 主网前演练记录

## 0. 基本信息

- **演练名称：** P0.7 Testnet 应急演练
- **演练日期：** 2026-06-06
- **环境：** Sui Testnet
- **Package ID：** `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e`
- **执行钱包：** `0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07`
- **自动化脚本：** `app/scripts/p0-drills.ts`

## 1. 演练范围

- [x] A. 买入头寸（结算/claim 待 maturity）
- [x] B. Slash 触发 + paused 验证（resume 待 timelock）
- [x] C. SlashGovernance 多签 propose → execute
- [x] D. ZK submit/verify（challenge 需独立钱包；finalize 待窗口）
- [ ] E. 前端页面手工回归
- [ ] F. 告警链路与值班响应

## 3. 执行记录

| 演练 | 步骤 | 结果 | Digest | 备注 |
|------|------|------|--------|------|
| SETUP | merge USDC coins | success | njp6bH3QqX6qv5tEShQH3XGLqbuqJh6M7uMm7umKRvu |  |
| A | deposit_liquidity 50 USDC (buy 准备) | success | D6T3GrTQaScRSYzDkAFqy1dygyUbaavQ1cpF8NMK2kgh |  |
| A | buy_poisson_digital k=7 0.01 USDC | success | GzYo8Shz5Sc7JU212TLsubR7Ydx6TQ3EUWp4LrMrN8yN |  |
| A | report_resolution + claim_position | skipped |  | 池 maturity 在未来；到期后用 settlement_oracle::report_resolution 再 claim |
| B | deposit_liquidity 10 USDC (slash 准备) | success | H79aq96MNkrrEXxALKa1JCUnBy9kFB2NhbnP7KfFU3q |  |
| B | slash_pool 1 USDC | success | 9xLZfHSrG1qbrTeUsDSrAKWqkKSCyvUG28eFGiNnW8mj |  |
| B | verify pool.paused | success | 9xLZfHSrG1qbrTeUsDSrAKWqkKSCyvUG28eFGiNnW8mj | paused=true |
| B | unslash_resume_pool | manual |  | 需等待 slash timelock 1800s 后由 Admin 调用 unslash_resume_pool |
| SETUP | merge USDC coins | success | 2yHUfJzS11DedcVnx52hN3chma7BDaU8feGb5TrxVyzx |  |
| C | deposit_liquidity 5 USDC (gov 准备) | success | Ervev8J7rbXZBWZL9BZYk898dAfKyDL49zr41uSCqfbb |  |
| C | init_slash_governance threshold=1 | success | HKki2pB9ScBdawhVuFW1ASxEQJ7JJ7Y3RVLcaNFJwSmL |  |
| C | propose_slash_request 0.5 USDC | success | CcXVAQxf9yox2FUjawY7QuwFyKPZCvMZgFfK5t8M8Vav |  |
| C | execute_slash_request (threshold=1) | success | 9zbRnu669BW5WQf3ScTfxLJtpNsjty9TVskmdxRLyg4i |  |
| D | submit_proof | success | FwjL1XQnfY8MVfyKLgSX81mvAPePwbHMMPG9VS5JDVkA |  |
| D | verify_proof accepted | success | 322hKSKstbsbrmHNQTG4TLHw7Ns1F31aS77o1LJcGmzV |  |
| D | challenge_verification | skipped |  | verifier 与 challenger 不可为同一地址（链上约束）；主网需独立挑战者钱包 |
| D | finalize_verification | manual |  | 需 challenge 窗口 3600s 结束后 Admin finalize |

## 5. 演练结论

- **总体结论：** 通过（含 manual 项待补完）
- **Manual 待办：** B resume (1800s) · D finalize (3600s) · A claim (maturity 后)

## 7. 复核与签字

协议 / 风控 / 运维 / 产品负责人签字：待完成
