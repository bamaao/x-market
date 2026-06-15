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

# 治理参数签字记录（P0.6）

> **基线文件：** [governance-params-baseline.json](./governance-params-baseline.json)  
> **人类可读表：** [mainnet-governance-params.md](./mainnet-governance-params.md)  
> **自动校验：** `.\scripts\verify-governance-params.ps1`

---

## 0. 元数据

| 项 | 值 |
|----|-----|
| 基线版本 | `1.0.0` |
| 锁定日期 | 2026-06-06 |
| Git commit | `e3e3ec16b9ea96255915c9baab15b0dc81dbc4a9`（升级后请更新） |
| Package ID (Testnet v3) | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| 校验命令 | `.\scripts\verify-governance-params.ps1` |
| 校验结果 | **16/16 通过**（2026-06-06） |

---

## 1. 主网确认值摘要（已锁定）

### LP Guard

| 参数 | 主网确认值 |
|------|------------|
| 种子池基础费率 | **200 bps** |
| Keeper 有效费率上限 | **800 bps** |
| Keeper 费率乘数上限 | **30000** |
| 虚拟 σ / 浓度上限 | **20 / 50** |
| 申购截止 | **1000 bps**（到期前 10%） |
| 结算时间锁 | **86400 s**（24h） |
| Keeper 轮询 / 衰减 | **30s / 0.85** |

> Testnet 种子池当前 `fee_bps=30`、`deposit_cutoff=0` 仅为联调，**不**作为主网默认值。

### Slash

| 参数 | 主网确认值 |
|------|------------|
| Timelock | **1800 s** |
| 单次上限 | **30%** |
| 周期累计上限 | **50%** |
| 多签 `SlashGovernance` | **启用**（主网初始化时创建） |

### ZK / Oracle / Prophet / Gas Station

| 模块 | 主网确认值 |
|------|------------|
| ZK challenge 窗口 | **3600 s**；finalize 责任人：**协议运营 on-call** |
| Oracle 最低押金 | **10 USDC**；争议窗口 **86400 s** |
| Prophet 协议费 | **5%**；付费门槛 **3 场审计 + Score ≥ 40** |
| Gas Station 限流 / 余额告警 | **30/min**；**0.5 SUI** |

---

## 2. 双人复核签字

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 协议负责人 | | | |
| 风控负责人（复核） | | | |
| 运维负责人 | | | |
| 产品负责人 | | | |

---

## 3. 确认清单

- [x] `governance-params-baseline.json` 已填写
- [x] `mainnet-governance-params.md` 主网确认值已填写
- [x] `verify-governance-params.ps1` 已通过（16/16，2026-06-06）
- [ ] 与 `mainnet-readiness-checklist.md` §3 一致
- [ ] 双人复核签字完成
- [ ] 签字扫描件归档（非 git）

---

## 4. 变更流程

主网发布前若调整任一参数：

1. 更新 `governance-params-baseline.json` 并 bump `version`
2. 同步 `mainnet-governance-params.md`
3. 重新运行 `verify-governance-params.ps1`
4. 新版签字记录归档
