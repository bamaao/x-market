# X-Market Sui Phase 2 操作手册

本文用于在 **Sui Testnet** 上完整跑通 Phase 2 的各项进阶功能：

- **LP Guard (防守机制)**：动态费率、虚拟流动性、T2 禁申购、结算时间锁
- **LP 赎回**：`withdraw_liquidity` (按 NAV 销毁 LpShare 提取 USDC)
- **高级衍生品**：线性期权 (Linear Call/Put)、Straddle
- **资金效率**：Cross-Margin 链上账本与前端组合 VaR 估算

---

## 1. LP Guard (防守机制) 配置

Phase 2 为 `MarketPool` 引入了多重防守参数，保护 LP 免受逆向选择和末期套利。

### 1.1 链上配置脚本

使用 `scripts/set-lp-guard.ps1` 脚本可以随时更新 Trading 状态池子的防守参数（仅限 Pool 的 Authority/创建者调用）。

```powershell
.\scripts\set-lp-guard.ps1 -PoolId 0x你的PoolID `
  -FeeMultiplierBps 5000 `
  -SigmaVirtualTenths 2 `
  -ConcentrationVirtual 10 `
  -DepositCutoffBps 1000 `
  -ResolutionWindowTs 3600
```

**参数释义：**
- `FeeMultiplierBps`: 动态费率乘数。如基础费率 30bps，设为 5000 (50%)，则有效费率 = `30 * (1 + 50%) = 45 bps`。
- `SigmaVirtualTenths`: (Normal池) 虚拟波动率。如设为 2，则定价时使用的 $\sigma$ 会比实际大 0.2，使报价更平缓。
- `ConcentrationVirtual`: (Dirichlet池) 虚拟浓度。如设为 10，则每个 outcome 的 $\alpha$ 均增加 10，使概率向均值回归。
- `DepositCutoffBps`: T2 禁申购窗口。设为 1000 (10%) 表示在距离到期前 10% 的时间段内，禁止 `deposit_liquidity`。
- `ResolutionWindowTs`: 结算时间锁。设为 3600 (秒) 表示在到期前 1 小时内禁止任何 `buy_*` 操作。

### 1.2 前端观测

在前端市场页 `/markets/[id]`，现在包含一个 **"IV / LP Guard 面板"**。
输入 Pool ID 即可实时观测当前池子的基础费率、有效费率、虚拟 $\sigma$ 等状态。

---

## 2. LP 赎回 (Withdraw Liquidity)

Phase 1.5 实现了按 NAV 申购，Phase 2 补齐了按 NAV 赎回。

### 2.1 前端操作

1. 导航至 `/lp` (LP 份额页面)。
2. 页面会列出你拥有的所有 `LpShare` 对象。
3. 在对应的卡片中，填入该市场对应的 `Pool ID`。
4. 点击 **"赎回 LP"**。
5. 链上会销毁该 `LpShare`，按当前 NAV 计算应得的 USDC，并转入你的钱包。

### 2.2 脚本操作

```powershell
.\scripts\withdraw-liquidity.ps1 -PoolId 0x你的PoolID -LpShareObjectId 0x你的LpShareID
```

---

## 3. 高级衍生品交易

Phase 2 在 Normal 市场（如 CPI、BTC 价格）引入了线性期权和跨式期权。

### 3.1 前端操作

1. 导航至 `/markets/normal-cpi` (或你创建的 Normal 市场)。
2. 在 **"交易面板"** 的 "合约类型" 下拉菜单中，现在可以选择：
   - **线性 Call**：看涨，结算收益为 $\max(X - K, 0)$
   - **线性 Put**：看跌，结算收益为 $\max(K - X, 0)$
   - **Straddle**：跨式，结算收益为 $|X - K|$
3. 输入 **"执行价 K (tenths)"**（例如 25）。
4. 输入 Stake (USDC)，点击 **"用 USDC 买入"**。

*注：线性产品的买入不仅会生成对应类型的 Position，还会动态推高池子的 $\sigma$（波动率），反映市场对极端行情的预期。*

---

## 4. Cross-Margin (全仓保证金)

Phase 2 实现了链上 `MarginAccount` 账本，允许用户将同一市场的多个 Position 绑定在一起，统一计算最大负债 (Max Liability)。

### 4.1 前端操作

1. 导航至 `/margin` (保证金页面)。
2. **新建账户**：填入 `Pool ID`，点击 "新建保证金账户"，钱包会收到一个 `MarginAccount` 对象。
3. **登记持仓**：填入 `Pool ID`、`MarginAccount ID` 和你的 `Position ID`，点击 "登记持仓"。
   - 链上会自动计算该 Position 在各离散槽位 (Slot) 的盈亏，并叠加到 `MarginAccount` 的总账本中。
4. **观测组合 VaR**：
   - 在 `/margin` 页面下方会显示你的 `MarginAccount`，包含 **Gross Stake** (总本金) 和 **Worst Liability** (最坏情况负债)。
   - 在 `/positions` (持仓页面) 顶部，也会通过前端聚合估算你所有持仓的 **Cross-Margin VaR**。

### 4.2 意义

通过 Cross-Margin，如果用户同时持有对冲的仓位（如同时持有 Call 和 Put，或者不同区间的 Interval），组合的最坏负债会显著低于各仓位独立计算时的负债之和。这为后续 Phase 3 引入杠杆交易奠定了底层基础。

---

## 5. 当前边界（Phase 2 vs Phase 3）

Phase 2 已实现：

- LP Guard（动态费率、虚拟流动性、时间窗口防守）
- NAV 赎回与 `T2` 末期禁申购
- 线性期权 / Straddle
- Cross-Margin 链上账本与前端 VaR 估算

Phase 3 已落地核心扩展：

- Tier-2 ZK 协处理接口：`submit_proof` / `verify_proof`
- Slash 风控处置：`slash_pool` / `unslash_resume_pool`
- 结构化票据篮子：Variance / Structured / Range / Barrier

请参考：[Phase 3 操作手册](./phase3-playbook.md)。