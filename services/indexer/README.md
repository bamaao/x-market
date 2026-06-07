# X-Market Indexer（P2 完整版）

PostgreSQL 链上索引 + REST API，覆盖市场发现、Prophet 排行、IV 曲线、争议案件与订阅者 ROI。

## 快速启动

```powershell
# 1. Postgres（Docker）
docker compose -f docker-compose.indexer.yml up -d postgres

# 2. 配置 + 启动
.\scripts\bootstrap-indexer-env.ps1
.\scripts\start-indexer.ps1
.\scripts\verify-indexer-health.ps1
```

## 环境变量

见 `.env.example`。关键项：

- `INDEXER_DATABASE_URL` — PostgreSQL 连接串
- `X_MARKET_PACKAGE_ID` / `PROPHET_REGISTRY_ID` / `ORACLE_CONFIG_ID`
- `SEED_DEPLOY_JSON` — 种子市场 bootstrap

## API

默认 `http://localhost:8800` — 完整端点见 [docs/p2-indexer-runbook.md](../../docs/p2-indexer-runbook.md)。

## Workers

| Worker | 间隔 | 职责 |
|--------|------|------|
| event | 15s | ProphecyCommitted、ArbitrationCaseOpened |
| snapshot | 60s | 池状态、feeds、iv_history |
| stats | 120s | prophet_stats、buyer_roi、案件刷新 |
