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

# PostgreSQL 15+：授予应用在 public schema 建表的权限（Ubuntu 本机 PG 常见）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

DB_USER="${XMARKET_PG_USER:-xmarket}"
DB_NAME="${XMARKET_PG_DATABASE:-xmarket_indexer}"
MODE="${1:-native}"

grant_sql() {
  cat <<SQL
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT CREATE ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
SQL
}

case "$MODE" in
  docker)
    require_cmd docker
    echo "Granting public schema to ${DB_USER} (docker) ..."
    grant_sql | docker compose -f docker-compose.indexer.yml exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
    ;;
  native)
    require_cmd psql
    echo "Granting public schema to ${DB_USER} (native) ..."
    local -a psql_cmd
    if [[ "$(id -u)" -eq 0 ]]; then
      psql_cmd=(runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB_NAME")
    else
      psql_cmd=(sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME")
    fi
    grant_sql | "${psql_cmd[@]}"
    ;;
  *)
    echo "Usage: $0 [docker|native]" >&2
    exit 1
    ;;
esac

echo "Schema public grants applied for ${DB_USER}@${DB_NAME}"
