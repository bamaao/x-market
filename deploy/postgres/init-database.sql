-- Copyright (c) 2026 zouyc zouyccq@gmail.com.
-- All rights reserved.
--
-- Licensed under the Business Source License 1.1 (BSL 1.1).
-- You may not use this file except in compliance with the License.
--
-- Change Date: 2031-01-01
-- On the Change Date, or the fourth anniversary of the first publicly available
-- distribution of the code under the BSL, whichever comes first, the code
-- automatically becomes available under the Apache License 2.0.

-- X-Market Indexer — 建库建用户（幂等）
-- 默认凭证与 docker-compose.indexer.yml 一致：
--   user=xmarket  password=xmarket  database=xmarket_indexer
--
-- 用法:
--   sudo -u postgres psql -f deploy/postgres/init-database.sql
--
-- 自定义用户/库名请用脚本（会生成临时 SQL）:
--   ./scripts/init-postgres.sh --mode sql --db-user myuser --db-pass secret --db-name mydb

\set ON_ERROR_STOP on

DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'xmarket') THEN
    CREATE ROLE xmarket LOGIN PASSWORD 'xmarket';
  END IF;
END
$do$;

SELECT 'CREATE DATABASE xmarket_indexer OWNER xmarket'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'xmarket_indexer'
)\gexec

GRANT ALL PRIVILEGES ON DATABASE xmarket_indexer TO xmarket;

\connect xmarket_indexer
GRANT ALL ON SCHEMA public TO xmarket;
GRANT CREATE ON SCHEMA public TO xmarket;
ALTER SCHEMA public OWNER TO xmarket;

\echo 'Ready: database=xmarket_indexer user=xmarket (public schema granted)'
