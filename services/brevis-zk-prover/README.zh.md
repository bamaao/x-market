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

# Brevis ZK Prover

**简体中文** | [English](./README.md)

PRD §3.6 · Phase 3 — **异步 ZK 监督线**（不阻塞 `buy_*` 热路径）。

## 架构

```
MarketPool 状态变更（checkpoint / 参数 / liability）
  → 链下审计（max-loss / 参数边界）
  → mock: 本地 SHA-256 证明哈希
  → live: Brevis RPC（可选）→ 失败则回退本地哈希
  → submit_proof → verify_proof_with_policy（委员会阈值）
  → 挑战窗口 3600s 后 Admin finalize_verification
```

> Brevis 尚无原生 Sui Move 验算器；本服务将 Brevis 证明输出映射为 `zk_coprocessor` 的 `proof_hash` / `public_inputs_hash`，链上仍为 Attestation + 挑战约束，与 [tier2-decision.zh.md](../../docs/tier2-decision.zh.md) 一致。

## 初始化

```powershell
.\scripts\init-zk-verifier-policy.ps1 -PackageId 0x... -VerifierAddress 0x...
.\scripts\bootstrap-services-env.ps1
```

## 环境

| 变量 | 说明 |
|------|------|
| `ZK_VERIFIER_POLICY_ID` | `init_verifier_policy` 创建的共享对象 |
| `ZK_PROVER_POOL_IDS` | 待审计池 ID 列表 |
| `ZK_PROVER_MODE` | `mock`（默认）或 `live` |
| `ZK_PROVER_DRY_RUN` | 默认 `true`；`false` 时实际上链 |
| `BREVIS_RPC_URL` | live 模式 Brevis Prover RPC（可选） |

## 运行

```powershell
cd services/brevis-zk-prover
npm install
npm run dev
# GET http://localhost:8794/health
```

## 测试

```powershell
npm test
```
