# Gas Station（赞助交易）

PRD §11.3.6 · Phase 4

## 是否需要本地服务？

**是。** Gas Station 必须运行链下 **Gas Payer 服务**，无法用纯前端或纯链上合约替代。

| 组件 | 部署位置 | 职责 |
| --- | --- | --- |
| Gas Payer 钱包 | 服务端密钥库 | 持有 SUI，作为 `gasOwner` 签署赞助交易 |
| Sponsor API | `services/gas-station/` | 校验 PTB 白名单 → `TransactionBlock` 双签 → 广播 |
| Web App | `app/src/lib/gas-station.ts` | 构建用户 PTB → 请求赞助 → 钱包签 USDC 部分 |

## 流程

```
用户钱包构建 PTB（仅 USDC transfer / unlock / commit）
        ↓
POST /v1/sponsor { txBytes, sender, allowedMoveCalls[] }
        ↓
服务端 dry-run 校验 → Gas Payer 签 gasData
        ↓
返回双签 bytes → 用户钱包签 authority → execute
```

## 白名单（MVP）

- `prophet_registry::commit_private_prophecy`（unlock_price = 0 免费练手）
- `prophet_registry::unlock_prophecy`
- `prophet_registry::audit_prophecy`
- `market_pool::buy_*`（可选）

## 环境变量（服务端）

```
GAS_PAYER_PRIVATE_KEY=...
SUI_RPC_URL=https://fullnode.testnet.sui.io
SPONSOR_RATE_LIMIT_PER_MIN=30
```

## 状态

- [ ] HTTP API 实现（`src/server.ts`）
- [ ] 前端 `useSponsoredTransaction` hook
- [ ] Testnet Gas Payer 充值与监控

用户侧仅看到 USDC 变动；SUI Gas 由协议代付。
