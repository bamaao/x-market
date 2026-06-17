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

# X-Market 生产后端 — 非 Docker 部署（Node.js 进程 + 可选 Docker Postgres）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deploy-backend-common.sh
source "${SCRIPT_DIR}/lib/deploy-backend-common.sh"

RUNTIME="native"
DEPLOY_MODE_NAME="native"
parse_deploy_backend_args "native" "$@"
validate_deploy_backend_args
require_cmd node
require_cmd npm

echo "=== X-Market Backend Deploy [Native] (profile=${PROFILE}) ==="
echo "Root:          ${XMARKET_ROOT}"
echo "Frontend:      ${FRONTEND_URL}"
echo "API base:      ${API_BASE_URL}"
echo "Postgres mode: ${POSTGRES_MODE}"
echo ""

if [[ "$INSTALL_DEPS" == "true" ]]; then
  if [[ "$POSTGRES_MODE" == "docker" ]]; then
    "${BACKEND_SCRIPT_DIR}/install-ubuntu-prerequisites.sh" --with-docker
  else
    "${BACKEND_SCRIPT_DIR}/install-ubuntu-prerequisites.sh"
  fi
fi

run_production_bootstrap

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  case "$POSTGRES_MODE" in
    docker)
      require_cmd docker
      echo "Starting Postgres (Docker only) ..."
      docker compose -f docker-compose.indexer.yml up -d postgres
      wait_postgres_healthy 90
      ;;
    native)
      "${BACKEND_SCRIPT_DIR}/setup-postgres-native.sh"
      ;;
    external)
      echo "Using external Postgres: XMARKET_INDEXER_DATABASE_URL"
      ;;
  esac
fi

native_args=(--profile "$PROFILE")
[[ "$SKIP_INSTALL" == "true" ]] && native_args+=(--skip-install)
[[ "$DRY_RUN_KEEPER" == "true" ]] && native_args+=(--dry-run-keeper)
"${BACKEND_SCRIPT_DIR}/start-backend-production-native.sh" "${native_args[@]}"

if [[ "$SETUP_SYSTEMD" == "true" ]]; then
  "${BACKEND_SCRIPT_DIR}/setup-systemd-production.sh" --profile "$PROFILE"
fi

run_nginx_setup

echo ""
echo "Waiting for services ..."
sleep 8

verify_ok=true
verify_backend_health || verify_ok=false

print_deploy_summary "./scripts/stop-backend-production.sh --mode native --profile ${PROFILE}"

if [[ "$verify_ok" != "true" ]]; then
  echo "Some health checks failed — inspect logs in .run/" >&2
  exit 1
fi
