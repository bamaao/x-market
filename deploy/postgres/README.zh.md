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

# Indexer PostgreSQL 初始化

## 两层结构

| 步骤 | 内容 | 位置 |
|------|------|------|
| **建库** | 创建角色 + 数据库 | `deploy/postgres/init-database.sql` |
| **建表** | 按序执行迁移 | `services/indexer/migrations/*.sql` |

默认凭证（与 `docker-compose.indexer.yml` 一致）：

```
用户: xmarket
密码: xmarket
数据库: xmarket_indexer
连接串: postgresql://xmarket:xmarket@localhost:5432/xmarket_indexer
```

## 一键脚本

```bash
# Docker Postgres + 建表
./scripts/init-postgres.sh --mode docker

# 本机 PostgreSQL（已安装 postgres）
./scripts/init-postgres.sh --mode native

# 本机首次：apt 安装 + 建库 + 建表
./scripts/init-postgres.sh --mode native --install-native

# 仅建库
./scripts/init-postgres.sh --mode sql

# 仅建表（库已存在）
./scripts/init-postgres.sh --mode migrate
# 或
./scripts/run-indexer-migrations.sh
```

Windows:

```powershell
.\scripts\init-postgres.ps1 -Mode docker
.\scripts\init-postgres.ps1 -Mode native
.\scripts\init-postgres.ps1 -Mode migrate
```

## 手动执行

```bash
# 1. 建库（postgres 超级用户）
sudo -u postgres psql -f deploy/postgres/init-database.sql

# 2. 建表
./scripts/bootstrap-indexer-env.sh   # 生成 INDEXER_DATABASE_URL
./scripts/run-indexer-migrations.sh
```

## 迁移文件（建表）

按文件名排序执行，已应用的版本记录在 `schema_migrations` 表：

| 文件 | 说明 |
|------|------|
| `001_init.sql` | 核心表：markets, prophecies, pool_snapshots, chain_events 等 |
| `002_market_image_url.sql` | markets.image_url |
| `002_p3.sql` | P3：buyer_roi, buyer_roi_summary, prophet_gmv_daily 等 |
| `003_p4.sql` | P4 扩展 |
| `004_uma_dvm.sql` | UMA DVM 仲裁 |
| `005_market_tags.sql` | tags, market_tags |
| `006_prophet_follows.sql` | prophet_follows |
| `007_market_comments.sql` | market_comments |

> **说明：** Indexer 启动时（`npm start`）也会自动跑迁移；`run-indexer-migrations.sh` 用于单独初始化或升级。

## Docker

`docker compose -f docker-compose.indexer.yml up -d postgres` 会通过环境变量**自动建库**，仍需跑迁移（`init-postgres.sh --mode docker` 或启动 Indexer）。
