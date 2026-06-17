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

# Ubuntu 24.04 本机 PostgreSQL（非 Docker）— Indexer 用
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

DB_USER="${XMARKET_PG_USER:-xmarket}"
DB_PASS="${XMARKET_PG_PASSWORD:-xmarket}"
DB_NAME="${XMARKET_PG_DATABASE:-xmarket_indexer}"

echo "=== Installing PostgreSQL (native) ==="
$SUDO apt-get update
$SUDO apt-get install -y postgresql postgresql-contrib

$SUDO systemctl enable postgresql
$SUDO systemctl start postgresql

echo "=== Creating role/database (idempotent) ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DB_USER="$DB_USER" DB_PASS="$DB_PASS" DB_NAME="$DB_NAME"
"${SCRIPT_DIR}/init-postgres.sh" --mode sql --skip-migrate \
  --db-user "$DB_USER" --db-pass "$DB_PASS" --db-name "$DB_NAME"

if pg_isready -U "$DB_USER" -d "$DB_NAME" -h localhost >/dev/null 2>&1; then
  echo "Postgres ready: postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
else
  echo "WARN: pg_isready failed — check PostgreSQL logs" >&2
  exit 1
fi
