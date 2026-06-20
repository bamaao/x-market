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

# X-Market on Sui

**简体中文** | [English](./README.md)

**Sui 预测市场产品体系** — Move 链上模块 + Circle 原生 `USDC` Vault + 参数化 AMM + SuiProphet 知识付费生态。

与 [X-Market on Solana](../x-market-solana) 无共用合约、流动性或部署；仅产品理念与数学规范同源。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│  应用层：Next.js Web · Flutter Mobile · Indexer                 │
├─────────────────────────────────────────────────────────────────┤
│  业务模块层                                                      │
│  ┌──────────────────────┐    ┌────────────────────────────┐    │
│  │ X-Market 博弈模块       │    │ SuiProphet 付费模块          │    │
│  │ MarketPool · Position  │    │ PrivateProphecy · 排行榜     │    │
│  └──────────┬───────────┘    └─────────────┬──────────────┘    │
│             └──────────────┬─────────────────┘                    │
│                            ▼                                    │
│              EventRoot / MarketPool（市场根 · shared）            │
├─────────────────────────────────────────────────────────────────┤
│  统一全链事件中心（Oracle）                                        │
│  macro_oracle · oracle_arbitrator · DataFeed · 委员会终裁         │
└─────────────────────────────────────────────────────────────────┘
```

| 层级 | 目录 | 说明 |
| --- | --- | --- |
| 链上合约 | `sources/` | Move 模块：AMM、Oracle、Prophet、LP、保证金等 |
| Web 前端 | `app/` | Next.js 15 + `@mysten/dapp-kit` |
| 移动端 | `mobile/x_market_flutter/` | Flutter + Rust pricing bridge |
| 链下服务 | `services/` | Indexer、LP Guard、Oracle Relayer、Prophet Audit Keeper 等 |
| 定价引擎 | `pricing-engine/` | 链下 Preview（对齐 `math-spec`） |
| 数学规范 | `math-spec/` | Q32.32 定点数规范与测试向量 |
| 部署脚本 | `scripts/`、`deploy/` | Testnet 种子市场、服务 bootstrap |

## 仓库结构

```
x-market-sui/
├── sources/                  # Move 链上模块
├── math-spec/                # 数学规范与 LUT 生成脚本
├── app/                      # Next.js Web 前端
├── mobile/x_market_flutter/  # Flutter 移动端
├── services/
│   ├── indexer/              # PostgreSQL 链上索引 + REST API
│   ├── lp-guard-keeper/      # LP 动态费率调控
│   ├── chain-monitor/        # 服务健康聚合
│   ├── oracle-relayer/       # Oracle 提议中继
│   ├── walrus-relay/         # Walrus 存储中继
│   ├── prophet-audit-keeper/ # 预言审计 Keeper
│   ├── uma-dvm-relayer/      # UMA DVM 中继
│   └── brevis-zk-prover/     # ZK Coprocessor 证明
├── pricing-engine/             # 链下定价 Preview
├── faucet/                   # Testnet USDC Faucet（可选）
├── deploy/                   # Testnet / Mainnet 部署记录
├── scripts/                  # PowerShell / Bash 运维脚本
├── docs/                     # Runbook、Playbook、FAQ
├── docker-compose.services.yml
├── docker-compose.indexer.yml
├── Move.toml
└── PRD.md
```

## 前置要求

| 组件 | 版本 / 工具 |
| --- | --- |
| 链上开发 | [Sui CLI](https://docs.sui.io/guides/developer/getting-started)（Move 2024.beta） |
| Web 前端 | Node.js 20+、npm |
| 链下服务 | Node.js 20+、Docker（PostgreSQL） |
| 移动端 | Flutter 3.x、Rust toolchain（`flutter_rust_bridge`） |
| 数学 LUT | Python 3.10+ |

## 快速开始

### 1. 链上合约

```powershell
# 生成 exp 查表（首次或 math-spec 变更后）
python math-spec/scripts/gen_exp_neg_lut.py

# 单元测试与编译
sui move test
sui move build

# 发布 Testnet（需配置 sui client）
sui client publish --gas-budget 500000000
# 完整记录见 deploy/testnet-v2.json
```

### 2. Web 前端

```powershell
cd app
cp .env.example .env.local   # 填入 Testnet Package / 服务 URL
npm install
npm run dev                  # http://localhost:3000
```

主要页面：`/markets` 市场列表 · `/lp` LP 面板 · `/positions` 持仓 · `/prophet` 预言家 · `/leaderboard` 排行榜

### 3. 链下服务（P0 / P1）

```powershell
# 从 deploy/testnet-v2.json 生成 .env.local
.\scripts\bootstrap-services-env.ps1

# 本地进程启动
.\scripts\start-services-testnet.ps1
.\scripts\verify-services-health.ps1

# 或使用 Docker
docker compose -f docker-compose.services.yml up -d --build
```

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| LP Guard Keeper | 8788 | 种子池动态费率调控 |
| Chain Monitor | 8789 | 服务健康聚合 |
| Oracle Relayer | 8790 | Oracle 提议中继 |
| Walrus Relay | 8791 | Walrus 存储中继 |

详见 [docs/services-testnet-runbook.md](./docs/services-testnet-runbook.md) 及各服务 README。

### 4. Indexer（P2）

```powershell
# 启动 PostgreSQL
docker compose -f docker-compose.indexer.yml up -d postgres

# 配置并启动 Indexer
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
# API 默认 http://localhost:8800
```

详见 [services/indexer/README.md](./services/indexer/README.md) 与 [docs/p2-indexer-runbook.md](./docs/p2-indexer-runbook.md)。

### 5. 定价引擎

```powershell
cd pricing-engine
npm install
npm start                    # http://localhost:8801
```

### 6. 移动端（Flutter）

```powershell
cd mobile/x_market_flutter
.\scripts\bootstrap-mobile-env.ps1   # 仓库根目录执行
flutter pub get
flutter run
```

详见 [mobile/x_market_flutter/README.md](./mobile/x_market_flutter/README.md)。

### 7. Testnet 种子市场

```powershell
.\scripts\seed-testnet.ps1           # 创建 Poisson / Dirichlet / Normal 种子池
.\scripts\start-auction-pool.ps1 -Kind poisson   # 新建竞价池
```

## Testnet 部署（v2，当前）

完整记录见 [deploy/testnet-v2.json](./deploy/testnet-v2.json)。

| 资源 | ID |
| --- | --- |
| Package | `0x083d470a44ce73a290368ec18a8ee96c49cc3491e29117737e62c9f57dbec57d` |
| GlobalConfig | `0x55d3205160a04f43eabcc3ee1dadd8cc39a071e0791cda00af3dd96258fe1111` |
| AdminCap | `0x5560450916bf31807ab5b3a389d9895c92d18de68e770ebe598ca3aa3f3ed528` |
| OracleConfig | `0x4d3e154b88aae952099c91bbb28c50c49140a3954d223f9c84570722b7a39f8a` |
| ProphetRegistry | `0x1f654bad17271115bebd91e92639a0f80157539779192022ffb1d959a5f115c3` |
| Poisson 池 | `0x075799eb6efda59c1834d8e70338cb11c9dc56c567c5ddb113a742ff419cc0d5` |
| Dirichlet 池 | `0x296c749d8257d68a31a1da3b715ccb01acfabb85112e5cc9885755818b3dcd5e` |
| Normal 池 | `0x407cbfcbab839d1fd192bf694d582c7cc1686b3ec7aed1b4e6f19335bb98cf91` |

浏览器：[Suivision Package](https://testnet.suivision.xyz/package/0x083d470a44ce73a290368ec18a8ee96c49cc3491e29117737e62c9f57dbec57d)

> 旧版部署见 `deploy/testnet.json`（已 superseded）。

### USDC（Circle 原生）

协议使用 **Circle 原生 USDC**（非自铸测试币）：

| 网络 | Coin Type |
| --- | --- |
| Testnet | `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC` |
| Mainnet | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` |

1. **获取测试网 USDC**：[Circle 测试网文档](https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui)，或 `.\scripts\transfer-test-usdc.ps1 -Recipient 0x…`
2. **买入**：连接钱包 → 选择区间/数字期权 →「用 USDC 买入」（Gas 为 SUI）
3. **持仓**：`/positions` 查看 Position，结算后领取赔付

## 核心能力

### X-Market 博弈模块

| 能力 | 状态 |
| --- | --- |
| Tier 1：Poisson / Dirichlet / Normal | ✅ |
| 区间 + 数字期权 | ✅ `buy_*_interval` / `buy_*_digital` |
| USDC Vault + Max-Loss | ✅ |
| Opening Auction → Trading → Settled | ✅ |
| NAV 申购 / LP Token | ✅ `deposit_liquidity` + `LpShare` |
| Oracle 结算（乐观 + 争议 + 终裁） | ✅ `macro_oracle` + `settlement` |
| 交叉保证金 | ✅ `cross_margin` |
| LP Guard 动态费率 | ✅ `lp_guard` + Keeper |

### SuiProphet 付费模块

| 能力 | 状态 |
| --- | --- |
| 私密预测 Commit（Seal 加密） | ✅ `prophet_registry` |
| 战绩 / Prophet Score | ✅ `prophet_leaderboard` |
| 排行榜（链上 + Indexer） | ✅ `/leaderboard` |
| 付费预测赛前数字保密（BCS + audit reveal） | ✅ `prophet_plain` + `prophet_registry` |
| EventRoot 市场根抽象 | ✅ `event_root`（迁移中） |

## Vault

USDC 托管在共享对象 `MarketPool.vault: Balance<USDC>` 内。结算与赔付均从 Vault 进出，受 Max-Loss 约束。

## 文档索引

### 产品与规范

- [PRD.zh.md](./PRD.zh.md) — 产品需求文档
- [math-spec/SPEC.zh.md](./math-spec/SPEC.zh.md) — Tier 1 链上数学规范
- [docs/business-spec.zh.md](./docs/business-spec.zh.md) — 业务规格
- [docs/glossary.zh.md](./docs/glossary.zh.md) — 全系统术语百科
- [docs/qa.zh.md](./docs/qa.zh.md) — Q&A
- [docs/faq-public.zh.md](./docs/faq-public.zh.md) — 公开 FAQ

### Phase Playbook

- [docs/phase1.5-playbook.zh.md](./docs/phase1.5-playbook.zh.md)
- [docs/phase2-playbook.zh.md](./docs/phase2-playbook.zh.md)
- [docs/phase3-playbook.zh.md](./docs/phase3-playbook.zh.md)
- [docs/phase4-services.zh.md](./docs/phase4-services.zh.md)

### 运维 Runbook

- [docs/services-testnet-runbook.zh.md](./docs/services-testnet-runbook.zh.md) — P0/P1 链下服务
- [docs/p1-services-runbook.zh.md](./docs/p1-services-runbook.zh.md)
- [docs/p2-indexer-runbook.zh.md](./docs/p2-indexer-runbook.zh.md) — Indexer
- [docs/p3-growth-runbook.zh.md](./docs/p3-growth-runbook.zh.md)
- [docs/p4-scale-runbook.zh.md](./docs/p4-scale-runbook.zh.md)
- [docs/testnet-deployment.zh.md](./docs/testnet-deployment.zh.md)
- [docs/testnet-deployment-ubuntu.zh.md](./docs/testnet-deployment-ubuntu.zh.md)

### Oracle 与 Prophet

- [docs/oracle-playbook.zh.md](./docs/oracle-playbook.zh.md)
- [docs/prophet-playbook.zh.md](./docs/prophet-playbook.zh.md)
- [docs/prophet-market-and-encryption-guide.zh.md](./docs/prophet-market-and-encryption-guide.zh.md)
- [Macro_Data_Oracle.zh.md](./Macro_Data_Oracle.zh.md)
- [SuiProphet_Network.zh.md](./SuiProphet_Network.zh.md)

### Mainnet 就绪

- [docs/mainnet-readiness-checklist.zh.md](./docs/mainnet-readiness-checklist.zh.md)
- [docs/mainnet-infra-priority.zh.md](./docs/mainnet-infra-priority.zh.md)
- [docs/mainnet-governance-params.zh.md](./docs/mainnet-governance-params.zh.md)
- [docs/governance-params-signoff.zh.md](./docs/governance-params-signoff.zh.md)

### 其他

- [docs/tier2-decision.zh.md](./docs/tier2-decision.zh.md)
- [docs/slash-and-attestation.zh.md](./docs/slash-and-attestation.zh.md)
- [docs/deferred-features.md](./docs/deferred-features.md)
- [docs/demo-walkthrough.zh.md](./docs/demo-walkthrough.zh.md)

## 许可证

本项目采用 [Business Source License 1.1 (BSL 1.1)](./LICENSE)。Change Date：**2031-01-01**，到期后自动转为 Apache License 2.0。
