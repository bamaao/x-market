# X-Market Sui 主网上线前清单

本文将当前实现状态转成可执行上线步骤，默认面向 **Phase 3 已完成后的主网发布**。

---

## 1. 发布冻结与版本标记

- [ ] 冻结发布窗口（禁止非主网阻断类改动）
- [ ] 锁定目标提交哈希（记录 `git rev-parse HEAD`）
- [ ] 生成候选版本号（建议语义化版本，如 `v0.3.0-mainnet-rc1`）
- [ ] 输出变更摘要（协议、风控、前端、脚本、文档）

---

## 2. 合约与权限检查

- [ ] `sui move build` 无错误
- [ ] `sui move test` 全通过
- [ ] `GlobalConfig` 管理员地址确认（冷/多签地址）
- [ ] `AdminCap` 持有者迁移至治理地址
- [ ] 主网 `USDC` 类型地址替换与验证（禁用测试币路径）

---

## 3. 风险参数基线（上线前一次性确认）

### 3.1 LP 防守参数

- [ ] `fee_multiplier_bps` 基线确认
- [ ] LP Guard Keeper 已部署（`services/lp-guard-keeper/`，authority 密钥托管）
- [ ] `sigma_virtual_tenths` 基线确认
- [ ] `concentration_virtual` 基线确认
- [ ] `deposit_cutoff_bps` 基线确认
- [ ] `resolution_window_ts` 基线确认

### 3.2 Slash 治理参数

- [ ] timelock（当前实现：`1800s`）是否满足治理要求
- [ ] 单次限额（当前实现：`30%`）是否满足治理要求
- [ ] 周期累计限额（当前实现：`50%`）是否满足治理要求
- [ ] 是否启用多签执行通道（`SlashGovernance`）
- [ ] 若启用：`signers` 与 `threshold` 清单完成双人复核

### 3.3 ZK 流程参数

- [ ] challenge window（当前实现：`3600s`）是否满足治理要求
- [ ] 验证状态码语义对外文档一致（accepted/rejected/challenged）
- [ ] 运营侧明确 `finalize_verification` 触发策略与责任人

---

## 4. 治理与应急演练（必须留痕）

- [ ] 演练 A：正常买入/结算/兑奖全流程
- [ ] 演练 B：触发 `slash_pool` 后 timelock 到期恢复
- [ ] 演练 C：多签提案 `propose -> approve -> execute`
- [ ] 演练 D：`ZkVerification` challenge + delayed finalization
- [ ] 所有演练生成交易哈希与截图归档
- [ ] 按模板输出演练报告：`docs/mainnet-drill-record-template.md`

---

## 5. 前端与配置发布

- [ ] 主网环境变量注入：
  - `NEXT_PUBLIC_SUI_NETWORK=mainnet`
  - `NEXT_PUBLIC_PACKAGE_ID=<mainnet_package_id>`
  - `NEXT_PUBLIC_SUI_CLOCK=0x6`
- [ ] 前端合约入口与包 ID 一致性复核
- [ ] `/positions` 新票据展示与估算逻辑复测
- [ ] 关键页面手工回归（市场页、持仓页、LP 页）

---

## 6. 可观测性与告警

- [ ] 监控 `SlashRecord` 事件（数量、金额、触发人）
- [ ] 监控 `ZkVerification` 状态变化与未 finalize 积压
- [ ] 监控市场 `paused` 状态变化
- [ ] 监控关键交易失败率（buy/claim/deposit/withdraw）
- [ ] 告警值班表与升级路径（on-call）确认

---

## 7. 上线执行 Runbook

1. [ ] 发布主网包并记录 `Package ID`
2. [ ] 初始化/迁移治理对象（如 `SlashGovernance`）
3. [ ] 创建首批种子市场并注入初始流动性
4. [ ] 前端切主网配置并灰度发布
5. [ ] 观察 30-60 分钟关键指标
6. [ ] 对外宣布上线（附主网地址与风险提示）

---

## 8. 上线后 24 小时观察

- [ ] 每 2 小时复核一次资金与负债关键指标
- [ ] 核验至少 1 笔完整结算闭环交易
- [ ] 审核所有异常告警处理闭环
- [ ] 形成 `Day-1` 复盘文档（问题、修复、参数调整）

---

## 9. 当前已完成 vs 待完成（截至最近版本）

### 已完成

- `u64 -> u8` 窄化前边界校验已全链路落地
- Cross-Margin 同一持仓全局唯一注册锁已落地
- ZK challenge period + delayed finalization 已落地
- Slash timelock + 单次/累计限额 + 多签执行通道已落地

### 待完成

- 外部审计报告关闭所有主网阻断项
- 主网参数签字版（治理、风控、运营）归档
- 主网最终发布与 Day-1 复盘
