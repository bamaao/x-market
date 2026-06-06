# Oracle 结算 Playbook（Macro Data Oracle）



乐观预言机流程（见 [PRD.md §10](../PRD.md#10-宏观经济数据预言机macro-data-oracle)）：



```

事件发生 → propose_data（质押）→ 争议窗口 → [可选] 委员会终裁 → Pool Settled → claim

```



## 角色分工



| 角色 | 做什么 | 不是什么 |

| --- | --- | --- |

| **协议运营** | 创建 `OracleConfig`（含 `FeedRegistry`）、创建并绑定 `OracleArbitrator` | 不是争议终裁人、不逐市场注册 Feed |
| **市场创建者** | `create_*_pool_with_feed` 或 `register_data_feed_for_pool` | 非 Admin |

| **Proposer** | 官方数据发布后 `propose_data` | — |

| **Disputer** | 争议窗口内 `dispute_and_request_arbitration` | — |

| **委员会委员** | 对 `ArbitrationCase` 多签投票并 `execute_arbitration` | 不是 Admin 单方按钮 |



## 链上模块



| 模块 | 说明 |

| --- | --- |

| `macro_oracle` | `FeedRegistry`、创建者注册 Feed、提议、无争议 finalize、回调结算、消费 |
| `pool` | `create_*_pool_with_feed`：建市场同一 PTB 内自动注册 Feed |

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



### 3. 市场创建时自动注册 Feed（推荐）



新建市场时在同一 PTB 内调用 `pool::create_*_pool_with_feed`（内部 `register_feed_for_pool`），`FeedRegistry` 自动写入 `market_id → feed_id`。



```bash

# 示例：Normal 池 + Feed（参数以 pool.move 为准）

sui client call --package $PKG --module pool --function create_normal_pool_with_feed \

  --args $GLOBAL_CONFIG $ORACLE_CONFIG $FEED_REGISTRY $USDC_TYPE ... \

  "vector<u8>:US_CPI_2026_M05" $MATURITY_TS 86400 10000000 \

  "vector<u8>:https://bls.gov/... first release only"

```



`event_ts` 应 ≥ Pool `maturity_ts`。



**存量池补登**（仅 `MarketPool.authority`）：



```bash

sui client call --package $PKG --module macro_oracle --function register_data_feed_for_pool \

  --args $ORACLE_CONFIG $FEED_REGISTRY $POOL \

  "vector<u8>:US_CPI_2026_M05" $MATURITY_TS 86400 10000000 \

  "vector<u8>:https://bls.gov/... first release only"

```



Admin 治理路径 `register_data_feed` 仅用于迁移/异常修复。



### 4. 写入 `app/.env`（全局，无 per-market Feed）



```

NEXT_PUBLIC_ORACLE_CONFIG_ID=0x...

NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=0x...

NEXT_PUBLIC_ORACLE_MARKETS=normal,dirichlet,poisson   # 仅 poolId，Feed 链上发现

NEXT_PUBLIC_GLOBAL_CONFIG=0x...

```



前端通过 `FeedRegistry.lookup_feed_by_market(pool_id)` 或扫描 `DataFeed.market_id` 自动发现 Feed，**禁止**配置 `ORACLE_FEED_*`。



## 一键初始化（Testnet）



```powershell

.\scripts\init-oracle-testnet.ps1 -RegisterSeedFeeds

# 输出 NEXT_PUBLIC_ORACLE_CONFIG_ID / ORACLE_ARBITRATOR_ID → 写入 app/.env.local

```



脚本依次：`create_oracle_config` → `create_oracle_arbitrator` → `set_oracle_arbitrator`；可选为 `deploy/testnet.json` 种子池补登 Feed。



## 全流程（Web `/oracle`）



```
提议 → [争议窗口] → Finalize（无争议）或 委员会终裁（有争议）→ Pool resolved → /positions 领取
```



页面顶部有四步向导；争议立案后 **自动发现** `ArbitrationCase`（事件 `ArbitrationCaseOpened` + 对象扫描）。



## 结算操作



### Proposer（事件发生后）



- Web：`/oracle` → 选择市场（Pool）→ 自动链上发现 Feed → **提议结果**

- 链上：`macro_oracle::propose_data`



### Disputer（争议窗口内）



- Web：**争议并立案**（同一 PTB）

- 链上：`oracle_arbitrator::dispute_and_request_arbitration`

- 链上发出 `ArbitrationCaseOpened`；前端从交易 `objectChanges` 或事件索引 Case ID



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



Finalize 或委员会终裁后：Oracle 页显示结算横幅 → Web **持仓**页 → **领取赔付**（`settlement::claim_position`）。



### Case 发现（链下）



| 方式 | 说明 |

| --- | --- |

| 交易解析 | `getTransactionBlock` → `objectChanges` 中 `oracle_arbitrator::ArbitrationCase` |

| 事件 | `queryEvents` → `ArbitrationCaseOpened`，按 `assertion_id` 过滤 |

| 扫描 | `queryObjects` 过滤 `ArbitrationCase`，匹配 `assertion_id` 字段 |


