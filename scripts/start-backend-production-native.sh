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

# 非 Docker 模式启动生产链下服务（npm + nohup，日志在 .run/）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

PROFILE="p2"
SKIP_INSTALL=false
DRY_RUN_KEEPER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --dry-run-keeper)
      DRY_RUN_KEEPER=true
      shift
      ;;
    -h | --help)
      echo "Usage: $0 [--profile p1|p2|full] [--skip-install] [--dry-run-keeper]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

services=(gas-station lp-guard-keeper chain-monitor oracle-relayer walrus-relay)

for svc in "${services[@]}"; do
  [[ -f "services/${svc}/.env.local" ]] || {
    echo "Missing services/${svc}/.env.local — run bootstrap-production-env.sh first" >&2
    exit 1
  }
done

if [[ "$SKIP_INSTALL" != "true" ]]; then
  install_shared_npm_deps
  for svc in "${services[@]}"; do
    echo "npm install: services/${svc}"
    (cd "services/${svc}" && npm install --silent)
  done
fi

for svc in "${services[@]}"; do
  start_npm_service "$svc" "${XMARKET_ROOT}/services/${svc}"
done

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  [[ -f services/indexer/.env.local ]] || {
    echo "Missing services/indexer/.env.local" >&2
    exit 1
  }
  if [[ "$SKIP_INSTALL" != "true" ]]; then
    echo "npm install: services/indexer"
    (cd services/indexer && npm install --silent)
  fi
  start_npm_service indexer "${XMARKET_ROOT}/services/indexer"
fi

if [[ "$PROFILE" == "full" ]]; then
  [[ -f pricing-engine/.env.local ]] || {
    echo "Missing pricing-engine/.env.local" >&2
    exit 1
  }
  if [[ "$SKIP_INSTALL" != "true" ]]; then
    echo "npm install: pricing-engine"
    (cd pricing-engine && npm install --silent)
  fi
  start_npm_service pricing-engine "${XMARKET_ROOT}/pricing-engine"
fi

sleep 5
health_args=(--include-p1)
[[ "$PROFILE" == "full" ]] && health_args+=(--include-p4)
"${SCRIPT_DIR}/verify-services-health.sh" "${health_args[@]}" || true

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  "${SCRIPT_DIR}/verify-indexer-health.sh" || true
fi

if [[ "$PROFILE" == "full" ]]; then
  check_health pricing-engine "http://127.0.0.1:8801" || true
fi

echo "Native backend services started (profile=${PROFILE})"
