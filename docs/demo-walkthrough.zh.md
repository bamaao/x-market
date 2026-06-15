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

**简体中文** | [English](./demo-walkthrough.md)

# X-Market Sui 核心业务演示指南

> **版本：** v1.0 · **日期：** 2026-06-08  
> **用途：** 产品演示、投资人路演、内部 onboarding  
> **关联：** [test-cases.zh.md](./test-cases.zh.md) · [PRD.zh.md](../PRD.zh.md) · [deploy/testnet-v2.json](../deploy/testnet-v2.json)

---

## 1. 演示要讲清的故事

用 **一条线** 串起产品，避免模块堆砌：

```
现实世界事件（进球 / CPI / 胜平负）
        │
        ▼
   EventRoot + Oracle Feed（同一真相源）
        │
   ┌────┴────┐
   ▼         ▼
X-Market    SuiProphet
链上 AMM    私密预测 + 付费解锁
买 Position  事后审计战绩
   │         │
   └────┬────┘
        ▼
   Oracle 结算 → claim / audit
```

**三句话版本：**

1. **一个事件根节点** — 博弈与知识付费共用同一 Oracle 结果，数据不割裂。  
2. **Tier 1 链上定价** — 毫秒级 PDF 积分，无外部报价依赖（见 [tier2-decision.zh.md](./tier2-decision.zh.md)）。  
3. **乐观 Oracle + 经济约束** — 提议 → 争议 → 委员会；风控有 Slash / LP Guard（冷路径）。

---

## 2. 选哪条演示路线

| 路线 | 时长 | 适合场景 | 能否当场 claim |
| --- | --- | --- | --- |
| **路线 A · 闪电演示** | 15–20 分钟 | 路演、首次见面 | 否（口头说明） |
| **路线 B · 标准演示** | 35–45 分钟 | 客户 POC、团队培训 | 否（展示 Oracle 流程） |
| **路线 C · 完整闭环** | 跨 1–2 天 | 深度尽调、录屏留档 | 是（需提前建演示池） |

> **为何种子池通常不能当场 claim？**  
> [deploy/testnet-v2.json](../deploy/testnet-v2.json) 中种子池 `maturityTs` 在未来，且 Oracle 争议窗口为 24h。  
> 路线 C 会说明如何提前创建 **短到期演示池**。

---

## 3. 演示前检查清单

### 3.1 环境（演示前 30 分钟）

```powershell
# 仓库根目录
cd g:\apps\x-market-sui\app
cp .env.example .env.local   # 若尚未配置
npm install
npm run dev                  # http://localhost:3000
```

确认 `.env.local` 与 [deploy/testnet-v2.json](../deploy/testnet-v2.json) 一致（Package、三池 ID、Oracle、Prophet Registry）。

### 3.2 钱包

| 项 | 要求 |
| --- | --- |
| 网络 | Sui **Testnet** |
| SUI | ≥ 0.5 SUI（Gas） |
| USDC | ≥ 100 测试 USDC（演示买入 + Prophet 解锁） |

**领测试币：**

```powershell
# 有 TreasuryCap 时
.\scripts\mint-test-usdc.ps1

# 或前端市场页「铸造测试 USDC」（Faucet 包）
# 或请部署者：.\scripts\transfer-test-usdc.ps1 -Recipient 0x你的地址
```

### 3.3 可选增强（Prophet Gas 赞助）

若演示 `/prophet` 的 **Gas Station 免 Gas Commit**：

```powershell
.\scripts\bootstrap-services-env.ps1
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1   # Gas Station :8787 应 200
```

未启动时 Prophet 仍可用，用户自付 SUI Gas。

### 3.4 演示素材（建议提前准备）

| 素材 | 作用 |
| --- | --- |
| 已买入的 Position 1–2 个 | 打开 `/positions` 不必等链上确认 |
| Suivision 交易链接 1 条 | 讲解「链上原子定价」 |
| （路线 C）演示专用 Pool ID | 写入便签，页面手填 |

### 3.5 双钱包（演示 Prophet 付费解锁时）

| 钱包 | 角色 |
| --- | --- |
| 钱包 A | 预言家 Commit |
| 钱包 B | 订阅者 Unlock + 解密 |

可用两个浏览器（Chrome + Edge）或 Sui Wallet 多账户。

---

## 4. 路线 A · 闪电演示（15–20 分钟）

> **目标：** 让观众看到「能买、有链上头寸、产品形态完整」，不等待 Oracle 窗口。

### 步骤一览

| 步骤 | 页面 | 操作 | 讲解要点 |
| --- | --- | --- | --- |
| A1 | `/` | 展示三枚种子市场卡片 | 三种分布：Poisson / Dirichlet / Normal |
| A2 | `/markets/poisson-goals` | 连接钱包 → 铸造 USDC（若无） | Vault 托管 USDC，非 Uniswap 双币对 |
| A3 | 同上 · 交易面板 | 选「数字期权」k=3 或「区间」[2,3] → 买入 10 USDC | **Tier 1**：同一笔 tx 内改 λ + 铸 Position |
| A4 | `/positions` | 刷新，点开刚买的 Position | Owned Object，可 transfer |
| A5 | `/markets/normal-cpi` | 展示 IV / LP Guard 面板（填 Pool ID 若未自动） | LP 防守：动态费率、虚拟 σ |
| A6 | `/oracle` | 选 Poisson 市场 → 看 Feed 自动发现 | L0 与 L2 解耦；Feed 非 .env 硬编码 |
| A7 | （口头） | — | 结算需 maturity + Oracle finalize；生产无 Admin 单方按钮 |

### 推荐话术（A3 买入时）

> 「传统 AMM 换的是代币对；这里是 **参数化 AMM** — 用户用 USDC 买走的是赔付承诺，链上 Poisson 分布的 λ 会随这笔单一起更新。」

### 备用：若买入失败

| 现象 | 处理 |
| --- | --- |
| USDC 不足 | 铸造或合并 USDC |
| Gas 不足 | Testnet faucet 领 SUI |
| `paused` | 换种子池或查是否被 Slash 演练暂停 |
| 函数找不到 | 检查 `NEXT_PUBLIC_PACKAGE_ID` 是否为 v3 包 |

---

## 5. 路线 B · 标准演示（35–45 分钟）

在路线 A 基础上，增加 **Opening Auction、LP、Prophet、Oracle 提议**。

### 5.1 Opening Auction（约 8 分钟）

**方式一：前端（推荐）**

1. 打开 `/markets/dirichlet-wdl`
2. 滚动到 **AuctionPanel**
3. 填入 **新建** Auction Pool ID（见下方脚本）或同事提前创建的 ID
4. 选桶位 0/1/2，竞价 20 USDC → 再换桶位竞价（可换钱包模拟多人）
5. 竞价结束后点击 **finalize_auction** → 状态变 Trading

**方式二：演示前创建短竞价池**

```powershell
$env:X_MARKET_PACKAGE_ID="0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"

# 竞价 0 小时 = 创建后立即可 finalize；到期 30 天
.\scripts\start-auction-pool.ps1 -Kind dirichlet -AuctionHours 0 -MaturityDays 30
# 记录输出的 MarketPool Object ID
```

**讲解要点：**

> 「LP 不是换币对，而是 **承销先验概率** — 竞价桶比例决定 Dirichlet 的初始 α，finalize 后 AMM 才开放。」

### 5.2 LP 申购（约 5 分钟）

1. `/markets/dirichlet-wdl` → **LpDepositPanel**
2. 填入 **Trading** 状态的 Pool ID
3. 注入 50 USDC → `deposit_liquidity`
4. 打开 `/lp` → 看到 `LpShare` 对象

**讲解要点：** NAV 申购、Dirichlet α 等比缩放（概率形状不变）。

### 5.3 第二笔交易 + 结构化产品（约 5 分钟）

1. `/markets/normal-cpi` → 合约类型选 **Variance Swap** 或 **Range Note**
2. 小额买入 → `/positions` 看新标签

说明：Phase 3 票据仍是 **Normal + Tier 1**，不依赖 ZK 热路径。

### 5.4 SuiProphet 知识付费（约 10 分钟）

1. 打开 `/prophet`
2. **钱包 A**：选 Normal CPI 池 → 填写预测值 + 短分析 → **Commit**  
   （Seal 加密 → Indexer blob → 链上 `commit_private_prophecy`）
3. **钱包 B**：同一预言 → **Unlock**（付 USDC）→ 页面自动尝试解密
4. 打开 `/leaderboard` → 说明 audit 需 Oracle 结算后

**讲解要点：**

> 「带单和下注共用 **同一 Pool、同一 lock_time**；Oracle 结算后 `audit_prophecy` 对 blake2b256 验明文，改稿即 CHEAT。」

详细链上语义见 [prophet-playbook.zh.md](./prophet-playbook.zh.md)。

### 5.5 Oracle 提议（约 5 分钟）

1. `/oracle` → 选择 **Poisson 进球** 市场
2. 确认页面已 **自动发现 Feed**（无需手动填 Feed ID）
3. 填写 `claimed_value`（Poisson：outcome 槽位 0–14，如进球 3 → 填 `3`）
4. 点击 **提议结果** → 质押 USDC
5. 展示 **争议窗口倒计时**（Testnet 通常 24h）

**讲解要点：** 乐观博弈四阶段 — 提议 → 窗口 → [争议/委员会] → 消费。  
**诚实说明：** 当场无法 finalize；生产由 Proposer 或运营在窗口后触发。

### 5.6 风控冷路径（约 3 分钟，可选 PPT / 文档）

打开 [slash-and-attestation.zh.md](./slash-and-attestation.zh.md) 示意图，口头过：

- **Attestation**：ZK 监督登记 `proof_hash`，不阻塞 `buy_*`
- **Slash**：争议成立后罚没 Vault、暂停市场、1800s timelock 恢复

不必现场执行 `slash_pool`（会暂停种子池）。

---

## 6. 路线 C · 完整闭环（跨 1–2 天）

> **目标：** 录屏或尽调时展示 **买入 → 结算 → claim**，以及 Prophet **audit**。

### 6.1 演示前一日（T-1）

```powershell
$env:X_MARKET_PACKAGE_ID="0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"

# 1. 创建短到期 Poisson 演示池（竞价立即可 finalize）
.\scripts\start-auction-pool.ps1 -Kind poisson -AuctionHours 0 -MaturityDays 1

# 2. 记录 POOL_ID，前端 AuctionPanel finalize

# 3. 为该池注册 Feed（若未走 _with_feed）
#    见 init-oracle-testnet.ps1 或 /oracle 页「注册 Feed」

# 4. 买入区间 [2,4] 数字或区间合约，留 20 USDC
# 5. （可选）钱包 A 在 /prophet 对该 POOL_ID Commit
```

把 `POOL_ID`、预期 `resolved_value`（如进球 3）、买入区间记到演示备忘。

### 6.2 演示日 T — 结算与 claim

**前置：** 链上时间 ≥ `maturity_ts`。

#### 路径 C1 · 生产路径（Oracle 乐观流）

| 顺序 | 操作 | 页面/入口 |
| --- | --- | --- |
| 1 | `propose_data` | `/oracle` |
| 2 | 等待争议窗口（24h） | — |
| 3 | `finalize_assertion` | `/oracle` |
| 4 | Pool `resolved` | 页面状态变「已结算」 |
| 5 | `claim_position` | `/positions` |

适合 **T-1 提议、T 日 finalize** 的跨天录屏。

#### 路径 C2 · Testnet 快路径（仅联调，勿作生产叙事）

> 需要 **AdminCap**；maturity 必须已过。

```powershell
$PKG = "0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e"
$GLOBAL = "0x9ce278547f0590cc04a79f76cf97d103940557e7a3ff5bfecf5a99f198012b08"
$ADMIN = "0xb18fdb5f7ceaf2ccc9f94f35594043de3773422520666ec391e54e6b02b5b8c2"
$POOL = "0x你的演示池ID"
$CLOCK = "0x6"
# resolved_value：Poisson outcome 槽位，例如 3 表示总进球 3
$VALUE = 3

sui client call --package $PKG --module settlement_oracle --function report_resolution `
  --args $GLOBAL $ADMIN $POOL $VALUE $CLOCK --gas-budget 100000000
```

然后在 `/positions` 点击 **领取赔付**。

**对观众说明：** 「这是 Testnet 联调快路径；主网只走 Oracle 委员会终裁，无 Admin 单方结算。」

### 6.3 Prophet audit（路线 C 补充）

Oracle 结算且 `lock_time` 到达后：

1. `/prophet` → **审计** 步骤
2. 预言家提交与 Commit 时一致的明文
3. 链上比对 hash → WIN/LOSS/CHEAT → `/leaderboard` 更新

---

## 7. 页面速查（演示动线）

```
/  首页 · 种子市场入口
├── /markets/poisson-goals    足球 Poisson · 区间/数字
├── /markets/dirichlet-wdl    胜平负 · Auction + LP 面板
├── /markets/normal-cpi       CPI Normal · 结构化票据 + IV 面板
├── /positions                持仓 · claim
├── /lp                       LP 份额 · 赎回
├── /oracle                   Feed · 提议 · 争议 · Finalize
├── /prophet                  Commit · Unlock · Audit
├── /leaderboard              预言家战绩
└── /margin                   Cross-Margin（可选一笔带过）
```

---

## 8. 演示用链上 ID（Testnet v3）

来自 [deploy/testnet-v2.json](../deploy/testnet-v2.json)，演示前核对 `.env.local`：

| 资源 | ID |
| --- | --- |
| Package | `0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e` |
| Poisson 池 | `0xb5d1a85213d6757d1cb386e8b719b524162a117018e6f5b8f0101f4dcc532b5f` |
| Dirichlet 池 | `0x89fb5ff5754fe5b2d32d071ce98ad778b62a48f738e0d7dd27a86b390eddaac5` |
| Normal 池 | `0xa43716a746c01d6039cd7b9e6a77562f17a8730dc72c9363ddfde06859e4f834` |
| OracleConfig | `0x1ad185d06bcbb53a98c5a834516da7a28c748f32079faa8ff310a35d04f663d8` |
| ProphetRegistry | `0xfa8359d6e1693542ef315eeda6a5c6c659dc819683a7bf86ac3391d1c4f63f38` |
| Faucet 包 | `0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0` |

浏览器包页：  
https://testnet.suivision.xyz/package/0x2e368e00532771eedd2df288bd61b0cb2324471b9fc6e14160a7f3079310ae6e

---

## 9. 常见问题（演示现场）

| 问题 | 回答 / 处理 |
| --- | --- |
| 和 Polymarket 有何不同？ | 参数化 AMM + 链上 PDF；多种分布模板；LP 承销概率而非换币 |
| 为什么不用 Tier 2 / 链上 ZK？ | [tier2-decision.zh.md](./tier2-decision.zh.md)：主路径 Tier 1 已覆盖 MVP；ZK 为异步监督 |
| Oracle 谁说了算？ | 乐观提议 + 争议 + **委员会**多签，非 Admin 单方 |
| 当场能 claim 吗？ | 种子池一般不能；路线 C 或事先录屏 |
| Prophet 解密失败 | 检查包 ID 是否与加密时一致；Unlock 是否成功；SessionKey 是否过期 |
| Indexer blob 上传失败 | 确认 Indexer 已启动；`NEXT_PUBLIC_INDEXER_URL` 正确 |
| 页面空白 / RPC 超时 | 配置 `NEXT_PUBLIC_SUI_RPC_URL` 备用 RPC |

---

## 10. 演示后收尾

- [ ] 关闭 `npm run dev` 与 `stop-services-testnet.ps1`（若开了）
- [ ] 记录本次使用的 Pool ID、tx digest（便于复现）
- [ ] 若误 Slash 种子池：timelock 1800s 后 Admin `unslash_resume_pool`
- [ ] 反馈记入 [test-cases.zh.md](./test-cases.zh.md) 或 drill 记录

---

## 11. 相关文档

| 文档 | 何时翻阅 |
| --- | --- |
| [test-cases.zh.md](./test-cases.zh.md) | QA 回归、演示项转测试 |
| [phase1.5-playbook.zh.md](./phase1.5-playbook.zh.md) | Auction / LP 链上细节 |
| [oracle-playbook.zh.md](./oracle-playbook.zh.md) | Oracle 争议与委员会操作 |
| [prophet-playbook.zh.md](./prophet-playbook.zh.md) | Seal / Indexer blob 故障排查 |
| [phase3-playbook.zh.md](./phase3-playbook.zh.md) | Slash / ZK 若要做风控演示 |

---

## 修订记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-06-08 | v1.0 | 初版：路线 A/B/C、检查清单、页面动线、Testnet ID |
