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

# X-Market 生产后端 — Docker Compose 部署（Ubuntu 24.04）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deploy-backend-common.sh
source "${SCRIPT_DIR}/lib/deploy-backend-common.sh"

RUNTIME="docker"
DEPLOY_MODE_NAME="docker"
parse_deploy_backend_args "docker" "$@"
validate_deploy_backend_args
require_cmd docker

echo "=== X-Market Backend Deploy [Docker] (profile=${PROFILE}) ==="
echo "Root:         ${XMARKET_ROOT}"
echo "Frontend:     ${FRONTEND_URL}"
echo "API base:     ${API_BASE_URL}"
echo ""

if [[ "$INSTALL_DEPS" == "true" ]]; then
  "${BACKEND_SCRIPT_DIR}/install-ubuntu-prerequisites.sh" --with-docker
fi

run_production_bootstrap

compose_args=(-f docker-compose.production.yml)
if [[ "$EXPOSE_PUBLIC_PORTS" == "true" || "$API_ROUTING" == "vercel-proxy" ]]; then
  compose_args+=(-f docker-compose.production-public.yml)
  echo "Public port binding enabled (Vercel proxy / --expose-public-ports)"
fi
build_flag=(--build)
[[ "$SKIP_BUILD" == "true" ]] && build_flag=()

case "$PROFILE" in
  p1)
    echo "Starting P1 services (Docker) ..."
    docker compose "${compose_args[@]}" up -d "${build_flag[@]}"
    ;;
  p2)
    echo "Starting P1 + Indexer (Docker) ..."
    docker compose "${compose_args[@]}" --profile p2 up -d "${build_flag[@]}"
    ;;
  full)
    echo "Starting full stack (Docker) ..."
    docker compose "${compose_args[@]}" --profile full up -d "${build_flag[@]}"
    ;;
esac

run_nginx_setup

echo ""
echo "Waiting for services ..."
sleep 8

echo ""
echo "Docker status:"
docker compose "${compose_args[@]}" ps

verify_ok=true
verify_backend_health || verify_ok=false

print_deploy_summary "docker compose -f docker-compose.production.yml down"

if [[ "$verify_ok" != "true" ]]; then
  echo "Some health checks failed — inspect: docker compose -f docker-compose.production.yml logs" >&2
  exit 1
fi
