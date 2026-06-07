# LP Guard Keeper

链下动态费率引擎：监测 `MarketPool` 参数（`μ` / `λ` / `α`）在短时间窗口内的单边漂移、偏度与成交量冲击，自动调用 `pool::set_lp_guard_params` 抬高 `fee_multiplier_bps`、虚拟 `σ` / 浓度；风险消退后按衰减系数平滑回落。

## 架构

```
RPC 轮询池状态
  → 风险评分（漂移 40% + 偏度 35% + 成交量 25%）
  → 计算目标 fee_multiplier / sigma_virtual / concentration_virtual
  → authority 签名 set_lp_guard_params（非关键路径，不阻塞交易）
```

**要求：** Keeper 私钥对应地址须为各池 `MarketPool.authority`。

## 配置

复制 `.env.example` 为 `.env.local`：

| 变量 | 说明 |
| --- | --- |
| `LP_GUARD_POOL_IDS` | 逗号分隔 Trading 池 ID |
| `LP_GUARD_KEEPER_SECRET_KEY` | 池 authority 私钥 |
| `X_MARKET_PACKAGE_ID` | 已发布包 ID |
| `LP_GUARD_MAX_EFFECTIVE_FEE_BPS` | 有效费率上限（默认 800 = 8%） |
| `LP_GUARD_DRY_RUN` | `true` 时只打日志不发交易 |

**2% → 8% 示例：** 池基础费率 `fee_bps = 200`，风险满分时 Keeper 将 `fee_multiplier_bps` 拉到 `30000`，链上 `effective_fee_bps = 800`。

## 运行

```bash
cd services/lp-guard-keeper
npm install
npm test
npm run dev          # 开发（watch）
LP_GUARD_DRY_RUN=false npm start   # 生产发链上更新
```

## 健康检查

```
GET http://localhost:8788/health
```

返回 `keeper`、`pools`、`dryRun`、`gasBalanceMist`。生产模式（`LP_GUARD_PRODUCTION=true`）下余额不足或 `DRY_RUN=true` 会拒绝启动。

## Docker

见仓库根目录 `docker-compose.services.yml`。

## 与链上模块关系

- 计费：`sources/lp_guard.move`（`effective_fee_bps`）
- 写入：`pool::set_lp_guard_params`（仅 authority）
- 观测：前端 `IvPanel.tsx`
