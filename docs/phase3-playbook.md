# X-Market Sui Phase 3 操作手册

本文用于在 **Sui Testnet** 上跑通 Phase 3 的新增能力：

- Tier-2 ZK 协处理接口（`zk_coprocessor`）
- Slash 风控处置（`slash`）
- 结构化票据篮子（Variance / Structured / Range / Barrier）

---

## 1. 前置条件

- 已完成 Phase 1.5 与 Phase 2 部署流程
- 当前 `PACKAGE_ID` 为包含 Phase 3 代码的新包
- 钱包中有 USDC 与足够 SUI Gas
- 管理员地址持有 `AdminCap`

---

## 2. 发布与升级

在仓库根目录执行：

```powershell
sui move build
sui client publish --gas-budget 500000000
```

记录：

- `Package ID`
- `GlobalConfig`
- `AdminCap`

并更新前端环境变量：

```env
NEXT_PUBLIC_PACKAGE_ID=0x你的Phase3包ID
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_CLOCK=0x6
```

---

## 3. 结构化票据交易（前端）

进入任意 Normal 市场页面（例如 `/markets/normal-cpi`），在交易面板「合约类型」可选择：

1. **Variance Swap**
   - 参数：`K`
   - 收益：与 `(X-K)^2` 成正比，尾部波动敏感

2. **Structured Note（封顶看涨）**
   - 参数：`K`、`C`
   - 收益：`min(max(X-K, 0), C-K)`
   - 约束：`C > K`

3. **Range Note（区间票息）**
   - 参数：`L`、`U`
   - 收益：当 `X ∈ [L,U]` 支付固定票息
   - 约束：`U >= L`

4. **Barrier Note（障碍票息）**
   - 参数：`B`
   - 收益：当 `X >= B` 支付固定票息

---

## 4. ZK 协处理接口（链上）

模块：`x_market::zk_coprocessor`

> 当前版本为 **Attestation 过渡层**：链上记录 proof hash 与管理员验证状态，尚未在合约内执行通用密码学证明验证电路。

### 4.1 提交证明哈希

- 入口：`submit_proof(pool, proof_hash, clock)`
- 结果：用户钱包收到 `ZkProofTicket`（owned object）

### 4.2 管理员验证证明

- 入口：`verify_proof(config, cap, pool, ticket, status_code, clock)`
- `status_code`：
  - `1` = accepted
  - `2` = rejected
  - `3` = challenged
- 结果：生成共享对象 `ZkVerification`（初始为 `finalized=false`，默认挑战窗口 3600 秒）

### 4.3 挑战窗口内发起挑战

- 入口：`challenge_verification(pool, verification, clock, ctx)`
- 约束：仅在挑战窗口内可调用，窗口到期后不可再挑战
- 结果：`ZkVerification.status_code` 置为 `3`（challenged）

### 4.4 挑战窗口后最终确认

- 入口：`finalize_verification(config, cap, verification, clock, ctx)`
- 约束：仅管理员可调用，且必须在挑战窗口到期后
- 结果：`ZkVerification.finalized=true`

---

## 5. Slash 机制（链上）

模块：`x_market::slash`

### 5.1 执行 Slash

- 入口：`slash_pool(config, cap, pool, amount_usdc, reason_code, recipient, clock)`
- 行为：
  - 从 `MarketPool.vault` 扣减 `amount_usdc`
  - 转账到 `recipient`
  - 自动将市场 `paused = true`
  - 生成共享对象 `SlashRecord`

### 5.2 恢复市场

- 入口：`unslash_resume_pool(config, cap, pool)`
- 行为：将 `paused = false`

---

## 6. 持仓与风险观测

- `/positions` 页面已支持新票据类型标签展示：
  - Variance Swap
  - Structured Note
  - Range Note
  - Barrier Note
- Cross-Margin VaR 前端估算已覆盖这些新产品。

---

## 7. 常见排查

### 7.1 `Function not found`

说明仍在调用旧 `Package ID`。检查前端 env 与钱包交互目标包。

### 7.2 Structured / Range 参数报错

- Structured Note：需要 `C > K`
- Range Note：需要 `U >= L`

### 7.3 `insufficient_equity`（slash）

Slash 扣减金额超过池子可用 collateral。降低 `amount_usdc` 后重试。

---

## 8. 与后续主网阶段的关系

Phase 3 已补齐核心协议能力接口与产品形态；主网前仍建议继续完成：

- 审计与安全演练
- 风险参数基线（各票据的默认 K/C/L/U/B）
- 自动化告警与治理流程（配合 `SlashRecord` 与 `ZkVerification`）
