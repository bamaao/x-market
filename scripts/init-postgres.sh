#!/usr/bin/env bash
# Copyright (c) 2026 zouyc zouyccq@gmail.com.
# All rights reserved.
#
# Licensed under the Business Source License 1.1 (BSL 1.1).
# You may not use this file except in compliance with the License.
#
# Change Date: 2031-01-01
# On the Change Date, or the fourth anniversary of the first publicly available
# distribution of the code under the BSL, whichever comes first, the code
# automatically becomes available under the Apache License 2.0.

# PostgreSQL 建库 + Indexer 建表（一键）
#
# 用法:
#   ./scripts/init-postgres.sh --mode docker      # Docker Postgres + 迁移
#   ./scripts/init-postgres.sh --mode native      # apt 安装 + 建库 + 迁移
#   ./scripts/init-postgres.sh --mode migrate     # 仅建表（库已存在）
#   ./scripts/init-postgres.sh --mode sql         # 仅建库（不跑迁移）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

MODE="docker"
SKIP_MIGRATE=false
INSTALL_NATIVE=false
DB_USER="${XMARKET_PG_USER:-xmarket}"
DB_PASS="${XMARKET_PG_PASSWORD:-xmarket}"
DB_NAME="${XMARKET_PG_DATABASE:-xmarket_indexer}"

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --mode MODE       docker | native | migrate | sql  (default: docker)
  --skip-migrate    建库后不执行 migrations
  --install-native  native 模式时 apt 安装 PostgreSQL
  --db-user USER    default: xmarket
  --db-pass PASS    default: xmarket
  --db-name NAME    default: xmarket_indexer
  -h, --help

Files:
  deploy/postgres/init-database.sql          建库 SQL（手动 psql）
  services/indexer/migrations/*.sql          建表迁移（按序执行）

Environment:
  INDEXER_DATABASE_URL / services/indexer/.env.local
  XMARKET_INDEXER_DATABASE_URL               external 库连接串
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    --install-native)
      INSTALL_NATIVE=true
      shift
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --db-pass)
      DB_PASS="$2"
      shift 2
      ;;
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

run_init_sql() {
  require_cmd psql
  echo "Creating database ${DB_NAME} / user ${DB_USER} ..."

  local -a psql_cmd
  if [[ "$(id -u)" -eq 0 ]]; then
    psql_cmd=(runuser -u postgres -- psql -v ON_ERROR_STOP=1)
  else
    psql_cmd=(sudo -u postgres psql -v ON_ERROR_STOP=1)
  fi

  # stdin 传 SQL，避免 mktemp 文件 postgres 用户无法读取（Permission denied）
  "${psql_cmd[@]}" <<SQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$do\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
}

case "$MODE" in
  docker)
    require_cmd docker
    echo "Starting Docker Postgres ..."
    docker compose -f docker-compose.indexer.yml up -d postgres
    wait_postgres_healthy 90
    ;;
  native)
    if [[ "$INSTALL_NATIVE" == "true" ]]; then
      "${SCRIPT_DIR}/setup-postgres-native.sh"
    else
      run_init_sql
    fi
    ;;
  sql)
    run_init_sql
    echo "Database only — skip migrations (--mode sql)"
    exit 0
    ;;
  migrate)
  ;;
  *)
    echo "Invalid mode: ${MODE}" >&2
    exit 1
    ;;
esac

if [[ "$SKIP_MIGRATE" == "true" ]]; then
  echo "Skip migrations (--skip-migrate)"
  exit 0
fi

if [[ ! -f services/indexer/.env.local ]]; then
  if [[ -f "${SCRIPT_DIR}/bootstrap-indexer-env.sh" ]]; then
    "${SCRIPT_DIR}/bootstrap-indexer-env.sh"
  elif [[ -n "${XMARKET_INDEXER_DATABASE_URL:-}" ]]; then
    :
  else
    echo "Missing services/indexer/.env.local — run bootstrap-indexer-env.sh first" >&2
    exit 1
  fi
fi

"${SCRIPT_DIR}/run-indexer-migrations.sh"
echo ""
echo "Postgres init complete (mode=${MODE})."
echo "Next: ./scripts/start-indexer.sh  or  docker compose ... indexer"
