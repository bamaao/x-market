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

# 启动 Testnet 链下服务（P0 + P1 + 可选 P4）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

SKIP_INSTALL=false
P0_ONLY=false
INCLUDE_P4=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --p0-only)
      P0_ONLY=true
      shift
      ;;
    --include-p4)
      INCLUDE_P4=true
      shift
      ;;
    -h | --help)
      echo "Usage: $0 [--skip-install] [--p0-only] [--include-p4]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

services=(lp-guard-keeper)
if [[ "$P0_ONLY" != "true" ]]; then
  services+=(chain-monitor oracle-relayer walrus-relay)
fi
if [[ "$INCLUDE_P4" == "true" ]]; then
  services+=(prophet-audit-keeper)
fi

for svc in "${services[@]}"; do
  [[ -f "services/${svc}/.env.local" ]] || {
    echo "Missing services/${svc}/.env.local — run ./scripts/bootstrap-services-env.sh first" >&2
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

sleep 4

health_args=()
if [[ "$P0_ONLY" != "true" ]]; then
  health_args+=(--include-p1)
fi
if [[ "$INCLUDE_P4" == "true" ]]; then
  health_args+=(--include-p4)
fi
"${SCRIPT_DIR}/verify-services-health.sh" "${health_args[@]}"
