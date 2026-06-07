# P2 Indexer 完整 Runbook

> 非 MVP：Postgres 持久化 + 多 Worker + REST API，覆盖 P2.1–2.5（2.6 UMA DVM 评估见文末）。

## 架构

```
Sui RPC ──► Indexer Workers ──► PostgreSQL ──► REST API (:8800) ──► Next.js
              ├─ event-worker     prophecies, chain_events, arbitration
              ├─ snapshot-worker  pool_snapshots, iv_history, feeds
              └─ stats-worker     prophet_stats, prophet_stats_history, buyer_roi
```

## 数据表

| 表 | 用途 | P2 项 |
|----|------|-------|
| `markets` | 市场发现（替代 per-pool env） | 2.1 / 2.3 |
| `feeds` | Oracle DataFeed 索引 | 2.3 |
| `prophecies` | 预言提交索引 | 2.4 |
| `prophet_stats` | 排行缓存 | 2.4 |
| `prophet_stats_history` | 排名变化 | 2.4 |
| `pool_snapshots` | 池状态时间序列 | 2.1 |
| `iv_history` | Vol Crush 曲线 | 2.2 |
| `arbitration_cases` | 争议案件 | 2.5 |
| `buyer_roi` | 订阅者 ROI | 3.1 预置 |
| `chain_events` | 原始事件审计 | 2.1 |

## 启动（Testnet）

```powershell
docker compose -f docker-compose.indexer.yml up -d postgres
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
.\scripts\verify-p2-readiness.ps1
```

前端 `app/.env.local`：

```
NEXT_PUBLIC_INDEXER_URL=http://localhost:8800
```

## REST API

| 端点 | 说明 |
|------|------|
| `GET /health` | 服务与最近同步时间 |
| `GET /v1/markets` | 市场列表（首页发现） |
| `GET /v1/markets/:poolId` | 单市场 |
| `GET /v1/feeds` | Feed 列表 |
| `GET /v1/prophet/leaderboard?limit=50` | 排行 |
| `GET /v1/prophet/:addr/stats` | 单人战绩 |
| `GET /v1/prophet/:addr/history` | Score 历史 |
| `GET /v1/prophecies?pool_id=&prophet=` | 预言索引 |
| `GET /v1/pools/:poolId/snapshots` | 池快照 |
| `GET /v1/pools/:poolId/iv-history` | IV / Vol Crush |
| `GET /v1/arbitration/cases?status=&pool_id=` | 争议面板 |
| `GET /v1/buyer-roi?buyer=` | 跟单 ROI |
| `GET /v1/events?type=` | 链上事件审计 |

## 前端集成

- 首页 `MarketsGrid`：Indexer → env 回退
- `/leaderboard`：Indexer 排行 → RPC 回退
- `IvPanel`：Vol Crush 柱状图（`iv_history`）

## 运维

- 日志：`.run/indexer.log`
- 迁移：自动于启动时执行 `migrations/*.sql`
- Checkpoint：`indexer_checkpoints` 表（事件游标）
- RPC：`SUI_RPC_URL` + `SUI_RPC_URL_FALLBACK`

## P2.6 UMA DVM 适配器（已实现）

- Move：`create_uma_dvm_arbitrator` · `UmaDvmArbitrationRequested` · `execute_uma_dvm_arbitration`
- Relayer：`services/uma-dvm-relayer/`（`mock` / `live`）
- Indexer：`arbitration_cases.arbitration_adapter`（`builtin` | `uma_dvm`），迁移 `004_uma_dvm.sql`
- 脚本：`scripts/init-uma-dvm-arbitrator.ps1`

争议案件 API 不变；前端 `/oracle` 与 `ArbitrationCasesPanel` 按 adapter 展示流程差异。
