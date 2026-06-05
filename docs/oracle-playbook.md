# Oracle 结算 Playbook（Macro Data Oracle）

乐观预言机流程（见 [PRD.md §10](../PRD.md#10-宏观经济数据预言机macro-data-oracle)）：

```
事件发生 → propose_data（质押）→ 争议窗口 → [可选] 委员会终裁 → Pool Settled → claim
```

## 角色分工

| 角色 | 做什么 | 不是什么 |
| --- | --- | --- |
| **协议运营** | 创建 `OracleConfig`、注册 `DataFeed`、创建并绑定 `OracleArbitrator` | 不是争议终裁人 |
| **Proposer** | 官方数据发布后 `propose_data` | — |
| **Disputer** | 争议窗口内 `dispute_and_request_arbitration` | — |
| **委员会委员** | 对 `ArbitrationCase` 多签投票并 `execute_arbitration` | 不是 Admin 单方按钮 |

## 链上模块

| 模块 | 说明 |
| --- | --- |
| `macro_oracle` | Feed 注册、提议、无争议 finalize、回调结算、消费 |
| `oracle_arbitrator` | 委员会多签终裁（可插拔 DVM 适配入口） |
| `settlement_oracle` | Admin 快速上报（**仅** Testnet 联调，非生产路径） |
| `settlement` | 用户 `claim_position`（需 Pool 已 resolved） |

## 部署后初始化（协议运营）

### 1. 创建 OracleConfig

```bash
sui client call --package $PKG --module macro_oracle --function create_oracle_config \
  --args $GLOBAL_CONFIG $ADMIN_CAP 10000000 86400
# minimum_bond=10 USDC, liveness=24h
```

### 2. 创建仲裁委员会并绑定

```bash
# 委员地址列表 + 阈值（如 2-of-3）
sui client call --package $PKG --module oracle_arbitrator --function create_oracle_arbitrator \
  --args $GLOBAL_CONFIG $ADMIN_CAP '["0x委员1","0x委员2","0x委员3"]' 2

sui client call --package $PKG --module macro_oracle --function set_oracle_arbitrator \
  --args $GLOBAL_CONFIG $ADMIN_CAP $ORACLE_CONFIG $ARBITRATOR_ID
```

### 3. 为每个市场注册 DataFeed

```bash
sui client call --package $PKG --module macro_oracle --function register_data_feed \
  --args $GLOBAL_CONFIG $ADMIN_CAP $ORACLE_CONFIG $POOL_ID \
  "vector<u8>:US_CPI_2026_M05" $MATURITY_TS 86400 10000000 \
  "vector<u8>:https://bls.gov/... first release only"
```

`event_ts` 应 ≥ Pool `maturity_ts`。

### 4. 写入 `app/.env`

```
NEXT_PUBLIC_ORACLE_CONFIG_ID=0x...
NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=0x...
NEXT_PUBLIC_ORACLE_FEED_NORMAL=0x...
NEXT_PUBLIC_GLOBAL_CONFIG=0x...
```

## 结算操作

### Proposer（事件发生后）

- Web：`/oracle` → 选择 Feed → **提议结果**
- 链上：`macro_oracle::propose_data`

### Disputer（争议窗口内）

- Web：**争议并立案**（同一 PTB）
- 链上：`oracle_arbitrator::dispute_and_request_arbitration`
- 交易成功后记录返回的 **ArbitrationCase** 对象 ID

### 无争议 Finalize

- 争议窗口结束后，任何人可 **Finalize**
- 链上：`macro_oracle::finalize_assertion`

### 有争议 — 委员会终裁

1. 委员 **`propose_verdict`**（提议者胜 / 挑战者胜+采纳值 / 无法裁决）
2. 其他委员 **`approve_verdict`** 附议
3. 达阈值后任何人 **`execute_arbitration`** → 内部 `callback_arbitration_result`

| 裁决 | 链上效果 |
| --- | --- |
| 提议者胜 | 采纳原 `claimed_value`，双方退押金 |
| 挑战者胜 | 采纳 `resolved_value`，罚没提议者押金 |
| 无法裁决 | Feed 熔断，双方退押金 |

### 72h 无提议

- `macro_oracle::nullify_feed`

## 结果含义（claimed_value）

| 市场类型 | resolved_value 含义 |
| --- | --- |
| Poisson | outcome slot 0–14 |
| Dirichlet | 胜出 bucket 0–2 |
| Normal | 宏观数值（tenths，如 CPI 2.8% → 28） |

## 验证

```bash
sui move test   # macro_oracle_tests + oracle_arbitrator_tests
```

Finalize 或委员会终裁后：Web **持仓**页 → **领取赔付**。
