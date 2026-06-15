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

**简体中文** | [English](./mainnet-governance-params.md)

# X-Market Sui 主网治理参数基线（签字版）

> **用途：** P0.6 上线前一次性确认；双人复核后在本表签字。  
> **机器可读基线：** [governance-params-baseline.json](./governance-params-baseline.json)  
> **签字记录：** [governance-params-signoff.zh.md](./governance-params-signoff.zh.md)  
> **自动校验：** `.\scripts\verify-governance-params.ps1`

---

## 1. LP Guard（`lp_guard.move` / `pool::set_lp_guard_params`）

| 参数 | Testnet 实测 | 主网确认值 | 链上/链下字段 |
|------|--------------|------------|---------------|
| 基础费率 | 30 bps（联调） | **200 bps** | `fee_bps`（建池时） |
| 费率乘数上限 | 30000 | **30000** | `LP_GUARD_MAX_FEE_MULTIPLIER_BPS` |
| 有效费率上限 | 800 bps | **800 bps** | Keeper 计算封顶 |
| 虚拟 σ 上限 | 20 | **20** | `sigma_virtual_tenths` |
| 虚拟浓度上限 | 50 | **50** | `concentration_virtual` |
| 申购截止 | 0（未设） | **1000 bps** | `deposit_cutoff_bps` |
| 结算时间锁 | 0（未设） | **86400 s** | `resolution_window_ts` |
| Keeper 轮询 | 30s | **30s** | `LP_GUARD_POLL_MS` |
| 衰减系数 | 0.85 | **0.85** | `LP_GUARD_DECAY_FACTOR` |
| 更新阈值 | 200 bps | **200 bps** | `LP_GUARD_UPDATE_THRESHOLD_BPS` |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 2. Slash 治理（`slash.move`）

| 参数 | 链上常量 | 主网确认值 |
|------|----------|------------|
| Timelock | 1800 s | **1800 s** |
| 单次扣减上限 | 3000 bps (30%) | **30%** |
| 周期累计上限 | 5000 bps (50%) | **50%** |
| 提案 TTL | 86400 s | **86400 s** |
| 多签 `SlashGovernance` | 可选 | **启用** |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 3. ZK Coprocessor（`zk_coprocessor.move`）

| 参数 | 链上常量 | 主网确认值 |
|------|----------|------------|
| Challenge 窗口 | 3600 s | **3600 s** |
| Finalize 策略 | 窗口结束后触发 | **协议运营 on-call** 负责 `finalize_verification` |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 4. Macro Data Oracle（`macro_oracle.move`）

| 参数 | Testnet 链上 | 主网确认值 |
|------|--------------|------------|
| 最低押金 | 10_000_000 (10 USDC) | **10 USDC** |
| 争议窗口 | 86400 s | **86400 s (24h)** |
| 终裁 | `oracle_arbitrator` 多签 | **主网：内置委员会**；P2 评估 UMA DVM |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 5. SuiProphet（`prophet_registry` / `prophet_leaderboard`）

| 参数 | 链上常量 | 主网确认值 |
|------|----------|------------|
| 协议费 | 500 bps (5%) | **5%** |
| 付费开通最少审计 | 3 | **3** |
| 付费开通最低 Score | 4000 bps | **40/100** |
| 截止前关闭付费 | 300 s | **lock_time − 5 min** |
| 作弊上限（付费） | 0 | **0** |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 6. Gas Station（链下）

| 参数 | Testnet 预发 | 主网确认值 |
|------|--------------|------------|
| 赞助限流 / 地址 / 分钟 | 30 | **30** |
| Gas 余额告警 | 500_000_000 mist | **0.5 SUI** |
| 生产包 ID 校验 | 已启用 | **必须** |
| CORS | `http://localhost:3000` | **生产前端域名**（主网填写） |

**签字：** _______________ 日期：________  
**复核：** _______________ 日期：________

---

## 7. 确认清单

- [x] 上表「主网确认值」已填写
- [x] `governance-params-baseline.json` 已生成
- [x] `verify-governance-params.ps1` 通过（16/16）
- [ ] 与 `mainnet-readiness-checklist.zh.md` §3 一致
- [ ] 双人复核签字（见 [governance-params-signoff.zh.md](./governance-params-signoff.zh.md)）
- [ ] 扫描件归档至内部存储（非 git）
