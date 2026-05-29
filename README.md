# X-Market on Sui

**独立 Sui 项目** — Move 链上模块 + `Coin<USDC>` Vault + Parametric AMM。

与 [X-Market on Solana](../x-market-solana) 无共用合约、流动性或部署；仅产品理念与数学规范同源。

## 目录

```
x-market-sui/
├── PRD.md
├── docs/qa.md
├── math-spec/
├── sources/           # Move 模块
├── app/               # Next.js 前端 (Phase 1)
├── scripts/           # Testnet 种子市场
├── Move.toml
└── Move.lock
```

## 快速开始

```powershell
# 数学 LUT
python math-spec/scripts/gen_exp_neg_lut.py

# 链上测试
sui move test
sui move build

# 发布 Testnet
sui client publish --gas-budget 500000000
# 详见 deploy/testnet.json

.\scripts\seed-testnet.ps1   # 创建 3 个种子池

# 前端
cd app
cp .env.example .env.local   # 或已写入 Testnet 配置
npm install
npm run dev
```

## Testnet 部署（已发布）

| 资源 | ID |
| --- | --- |
| Package | `0xe6be1520c8f4753928b8daf5e45ca485b3c67cd0ab136874b5705bcf24eac8c1` |
| GlobalConfig | `0x6f5590350079a39c2ee8639d02c297835c2f07ce343c8baf5e8138271b6162ff` |
| AdminCap | `0xfba8d4081f560322175ea3a4fdc3250c690da29ae588586dbe379363178f01c3` |
| TreasuryCap (USDC) | `0x665f9aa32bbb18a65749b7fee38be8499d87fe0ddcdb8e8bbf738f4129975eaf` |
| Poisson 池 | `0x858f4b3c22aa5add2053895e6d5246ded7aa7361356313eca3a8a30c060d9c71` |
| Dirichlet 池 | `0xf5d1283915bc14e54b016cd1df263cb6f0775b84b40f2aff3262005300446dae` |
| Normal 池 | `0x694b31b28219505e1c92f628132eec7b63694f688da8ede7d3a2d136941931cf` |

完整记录见 [deploy/testnet.json](./deploy/testnet.json)。浏览器：[Suivision Package](https://testnet.suivision.xyz/package/0xe6be1520c8f4753928b8daf5e45ca485b3c67cd0ab136874b5705bcf24eac8c1)

### USDC 交易（Testnet）

1. **铸造测试 USDC**（需部署者钱包持有 `TreasuryCap`，或请其转账）：
   ```powershell
   .\scripts\mint-test-usdc.ps1
   # 或前端市场页「铸造」按钮（Faucet 包）
   ```
2. **Faucet 包**：`0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0`
3. **买入**：`cd app && npm run dev` → 连接钱包 → 选择区间/数字期权参数 →「用 USDC 买入」（自动合并多枚 USDC；Gas 仍为 SUI）
4. **持仓**：`/positions` 查看 Position，市场结算后可填写 Pool ID 领取赔付
5. **转 USDC 给测试者**：`.\scripts\transfer-test-usdc.ps1 -Recipient 0x…`

> 主包 `usdc::mint_to_sender` 在源码中已添加；链上可用独立 Faucet 包，无需 upgrade 主包。

## Phase 1.5 能力（链上 + 前端）

| 能力 | 状态 |
| --- | --- |
| Opening Auction（Poisson + Dirichlet） | ✅ `start_*_auction` / `auction_bid` / `finalize_*` |
| 状态机 Auction → Trading → Settled | ✅ `market_status` |
| NAV 申购 `deposit_liquidity` | ✅ `nav.move` + 全局缩放 Dirichlet α |
| LP Token `LpShare` | ✅ `lp_token.move`（赎回 Phase 2） |
| 前端竞价 / LP 面板 | ✅ `AuctionPanel` / `LpDepositPanel` / `/lp` |

```powershell
.\scripts\start-auction-pool.ps1 -Kind poisson   # 新建竞价池
.\scripts\start-auction-pool.ps1 -Kind dirichlet
```

## Phase 1 能力（链上）

| 能力 | 状态 |
| --- | --- |
| Tier 1：Poisson / Dirichlet / Normal | ✅ |
| 区间 + 数字期权入口 | ✅ `buy_*_interval` / `buy_*_digital` |
| USDC Vault + Max-Loss | ✅ |
| 结算 Oracle（Admin 上报，不参与定价） | ✅ `settlement_oracle` + `settlement` |
| Next.js 前端 + 3 种子市场配置 | ✅ `app/` + `scripts/seed-testnet.ps1` |

## Vault

USDC 托管在共享对象 `MarketPool.vault: Balance<USDC>` 内。

Dev 币种：`x_market::usdc::USDC`（包 `init`）；主网改用 Circle 官方 USDC。

## 文档

- [PRD.md](./PRD.md)
- [docs/qa.md](./docs/qa.md)
- [docs/phase1.5-playbook.md](./docs/phase1.5-playbook.md)
- [docs/phase2-playbook.md](./docs/phase2-playbook.md)
- [math-spec/SPEC.md](./math-spec/SPEC.md)
