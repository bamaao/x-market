# X-Market Sui Phase 1.5 操作手册

本文用于在 **Sui Testnet** 上完整跑通 Phase 1.5：

- Opening Auction（Poisson + Dirichlet + Normal）
- Auction -> Trading 状态切换
- NAV 申购 `deposit_liquidity`
- LP 份额对象 `LpShare`

---

## 1. 前置条件

### 1.1 工具与环境

- 已安装 Sui CLI，并可正常 `sui client active-address`
- 当前地址有足够 SUI 作为 gas
- 仓库已拉到本地：`g:\apps\x-market-sui`

### 1.2 关键事实（非常重要）

Phase 1.5 新增了链上模块/入口（例如 `start_dirichlet_auction`、`lp_token`、`nav`），因此：

- **必须发布包含 Phase 1.5 代码的新包**（或确认现有包已升级到本版本）
- 若继续使用旧包 ID，调用新入口会报 `Function not found`

---

## 2. 链上发布与验证

在仓库根目录执行：

```powershell
sui move test
sui move build
sui client publish --gas-budget 500000000
```

记录发布结果中的：

- `Package ID`
- `UpgradeCap`
- `TreasuryCap<USDC>`（若需要 Faucet 铸币）

建议把新包 ID 写入环境变量（便于脚本复用）：

```powershell
$env:X_MARKET_PACKAGE_ID="0x你的新包ID"
```

---

## 3. 启动 Auction 池

脚本：`scripts/start-auction-pool.ps1`

### 3.1 创建 Poisson Auction 池

```powershell
.\scripts\start-auction-pool.ps1 -Kind poisson -PackageId 0x你的新包ID -AuctionHours 24 -MaturityDays 30
```

### 3.2 创建 Dirichlet Auction 池

```powershell
.\scripts\start-auction-pool.ps1 -Kind dirichlet -PackageId 0x你的新包ID -AuctionHours 24 -MaturityDays 30
```

### 3.3 创建 Normal Auction 池（CPI 等宏观）

三桶锚点：μ = 2.0% / 2.5% / 3.0%（tenths 20/25/30），σ = 0.3% / 0.4% / 0.6%（tenths 3/4/6），按 USDC 加权定标。

```powershell
.\scripts\start-auction-pool.ps1 -Kind normal -PackageId 0x你的新包ID -AuctionHours 24 -MaturityDays 30
```

输出里会出现新 `MarketPool` 对象 ID，记下来用于前端竞价。

> `Clock` 默认 `0x6`，可用 `-ClockId` 覆盖。

---

## 4. 铸造测试 USDC

若你有 `TreasuryCap`，可直接：

```powershell
.\scripts\mint-test-usdc.ps1
```

或在前端市场页点击“铸造测试 USDC”按钮（通过 Faucet 包）。

---

## 5. 前端配置与启动

进入 `app` 目录，配置 `.env.local`（可从 `.env.example` 复制）：

```env
NEXT_PUBLIC_PACKAGE_ID=0x你的新包ID
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_CLOCK=0x6

# 下面可先填旧池，Auction 新池可在页面手填
NEXT_PUBLIC_POOL_POISSON=0x...
NEXT_PUBLIC_POOL_DIRICHLET=0x...
NEXT_PUBLIC_POOL_NORMAL=0x...
```

启动前端：

```powershell
cd app
npm install
npm run dev
```

---

## 6. 实操流程（推荐）

打开某个市场页 `/markets/[id]`，页面现在有三个面板：

- `TradePanel`（交易）
- `LpDepositPanel`（LP 申购）
- `AuctionPanel`（竞价 + finalize）

### 6.1 Opening Auction 竞价

1. 在 `AuctionPanel` 填入刚创建的 Auction Pool ID  
2. 选择桶位（0/1/2）  
3. 输入竞价 USDC，点击 `auction_bid`  
4. 重复多次，模拟不同参与者竞价

### 6.2 Auction 截止后定标

到 `auction_end_ts` 之后，点击 `finalize_auction`：

- Poisson：按 bucket 比例推导 `lambda_tenths`
- Dirichlet：按 bucket 比例生成初始 `alpha`
- 状态从 `Auction` 切到 `Trading`

同时，Auction 期间沉淀在 Vault 的资金会作为初始 LP 基础（`lp_shares` seed）。

### 6.3 Trading 期间 LP 申购（NAV）

在 `LpDepositPanel`：

1. 填 Trading 状态的 Pool ID
2. 输入注入 USDC
3. 点击 `deposit_liquidity`

链上行为：

- 按 `nav_pre` 计算应铸 LP 份额（非固定 1:1）
- Dirichlet 池执行 α 等比放大（保持概率形状）
- 铸造 `LpShare` 对象到钱包

### 6.4 查看 LP 份额

进入 `/lp`：

- 可看到 `LpShare` 对象
- 展示 shares 与对象 ID

---

## 7. 常见问题排查

### 7.1 `Function not found`

原因：仍在调用旧包 ID。  
处理：确认 `NEXT_PUBLIC_PACKAGE_ID`、脚本 `-PackageId`、钱包交互目标都指向新发布包。

### 7.2 `not_auction` / `auction_not_ended`

- `not_auction`：池子不在 Auction 状态（可能已 finalize）
- `auction_not_ended`：还没到截止时间

### 7.3 USDC 不足或支付失败

- 先铸造/转入 USDC
- 前端已支持自动合并多枚 USDC 后支付

### 7.4 Gas 不足

准备更多 SUI，必要时先合并 SUI coin。

---

## 8. 当前边界（Phase 1.5 vs Phase 2 / Phase 3）

Phase 1.5 已实现：

- Opening Auction（Poisson + Dirichlet）
- NAV 申购与 `LpShare`

后续进阶功能（Phase 2）现已全部实现：

- `withdraw_liquidity`（LP 赎回）
- `T2` 到期前禁申购
- 动态费率 / 虚拟流动性 / 结算时间锁
- 线性期权 / Straddle / Cross-Margin

后续扩展能力（Phase 3）现已实现核心协议形态：

- Tier-2 ZK 协处理接口（`zk_coprocessor`）
- Slash 风控处置（`slash`）
- 高级波动率与票据篮子：Variance Swap / Structured Note / Range Note / Barrier Note

请参考：

- [Phase 2 操作手册](./phase2-playbook.md)
- [Phase 3 操作手册](./phase3-playbook.md)

