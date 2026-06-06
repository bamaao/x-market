# SuiProphet Playbook

知识付费预言模块（PRD §11）。共用 L0 Oracle 结算，不另建 Feed。

## 架构

```
JSON 明文 → Seal.encrypt(seal_id) → Walrus PUT → Commit(chain)
                    ↓
         seal_approve_prophecy (OR: paid | lock_time | public)
                    ↓
         Seal.decrypt ← Walrus GET ← SessionKey 钱包签名
```

## 部署

### 1. 创建 ProphetRegistry

```bash
sui client call --package $PKG --module prophet_registry --function create_prophet_registry \
  --args $GLOBAL_CONFIG $ADMIN_CAP 500
```

### 2. 环境变量（`app/.env`）

```
NEXT_PUBLIC_PROPHET_REGISTRY_ID=0x...
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_EPOCHS=2
NEXT_PUBLIC_SEAL_THRESHOLD=1
```

Seal Testnet 密钥服务器（配置于 `app/src/lib/seal-prophet.ts` → `SEAL_KEY_SERVERS`）：

| 名称 | Object ID |
| --- | --- |
| mysten-testnet-1 | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` |
| mysten-testnet-2 | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` |

**注意：** 重新部署 Move 包后须用新 `PACKAGE_ID` 加密；旧密文无法被新 `seal_approve` 策略解密。

## 预言家 Commit

1. 生成 `seal_id`（32 字节随机）
2. `SealClient.encrypt({ packageId, id: hex(seal_id), data: canonical JSON })`
3. `PUT $PUBLISHER/v1/blobs?epochs=2` 上传密文
4. `commit_private_prophecy(registry, pool, blob_id, seal_id, plaintext_hash, …)`

链上：`lock_time` = Pool `maturity_ts`；`plaintext_hash` = blake2b256(canonical JSON)。

## 订阅者解锁 + 解密

1. `unlock_prophecy` 支付 USDC → `paid_buyers`（Seal **条件 A**）
2. 钱包签署 `SessionKey`（30 分钟 TTL）
3. PTB 仅调用 `seal_approve_prophecy(seal_id, prophecy, clock)`（dry-run 验证）
4. `SealClient.decrypt` + `GET $AGGREGATOR/v1/blobs/{blobId}`

## Web 全流程（`/prophet`）

页面四步向导与链上状态对齐：

| 步骤 | 操作 | 说明 |
| --- | --- | --- |
| 1. Commit | 预言家填写预测 + 分析 | Seal 加密 → Walrus 上传 → `commit_private_prophecy`；本地保存明文供审计 |
| 2. 解锁 | 订阅者支付 USDC | `unlock_prophecy`；成功后页面自动尝试 Seal 解密 |
| 3. 解密 | Walrus GET + Seal | 须满足 `paid_buyers` ∥ `lock_time` 后 ∥ `is_public`（`canSealDecryptProphecy`） |
| 4. 审计 | Oracle 结算后 | `audit_prophecy` 校验 blake2b256 明文 hash → 战绩 → `is_public` |

关键前端模块：

- `app/src/lib/prophet.ts` — 工作流推导、`decryptProphecyContent`、`extractProphecyIdFromTx`
- `app/src/lib/seal-prophet.ts` — Seal 1.x + SessionKey
- `app/src/lib/walrus.ts` — Testnet publisher / aggregator

双钱包 Testnet 验收：钱包 A Commit → 钱包 B Unlock（自动解密）→ Oracle 结算后 Audit。

## Seal OR 策略（`seal_approve_prophecy`）

| 条件 | 链上判定 |
| --- | --- |
| A 付费 | `sender ∈ paid_buyers` |
| B 公开 | `now > lock_time` 或 `is_public` |

## Oracle 审计 → 战绩 → 分账

前置：Pool 已 `resolved` 且 `now >= lock_time`（与 Oracle 页结算对齐，见 [oracle-playbook.md](./oracle-playbook.md)）。

### `audit_prophecy` 链上逻辑

1. `blake2b256(plaintext) == plaintext_hash`
   - **不匹配** → `status = CHEAT`，`is_public = true`，托管款均分退还 `paid_buyers`
2. **匹配** → 比对 `predicted_value` vs `pool.resolved_value`
   - 胜 → `status = WIN`；负 → `status = LOSS`
3. `is_public = true`（Seal 条件 B 全员可解密）
4. **分账**（托管 `escrow`）：
   - `protocol_fee = escrow × protocol_fee_bps / 10000` → `ProphetRegistry.treasury`
   - 余款 → 转账给预言家地址
5. **战绩** → `prophet_leaderboard` 动态字段（`wins/losses/cheats/streak/score_bps`）

### Web UI（`/prophet` 第 4 步）

- Hash 预校验、`resolved_value` 对比、分账预览（协议费 / 预言家实收）
- 提交 `audit_prophecy` 后刷新预言家战绩与全链排行榜
- 排行榜：`ProphecyCommitted` 事件发现预言家 → `getDynamicFieldObject(registry, prophet)` 读取 `ProphetStats`

## 模块

| 模块 | 说明 |
| --- | --- |
| `prophet_registry` | Commit / unlock / audit、`seal_approve_prophecy` |
| `prophet_leaderboard` | Prophet Score |
| `app/src/lib/seal-prophet.ts` | Seal 加解密 |
| `app/src/lib/walrus.ts` | Walrus HTTP 上传/读取 |

## 待办

- Gas Station 赞助交易
- 主网 Walrus publisher（需自建或 Upload Relay）
