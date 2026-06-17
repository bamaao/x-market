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

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

MODE="docker"
PROFILE="p2"
KEEP_POSTGRES=false

usage() {
  echo "Usage: $0 [--mode docker|native] [--profile p1|p2|full] [--keep-postgres]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --keep-postgres)
      KEEP_POSTGRES=true
      shift
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

echo "=== Stopping production backend (mode=${MODE}, profile=${PROFILE}) ==="

case "$MODE" in
  docker)
    docker compose -f docker-compose.production.yml --profile full down 2>/dev/null \
      || docker compose -f docker-compose.production.yml --profile p2 down 2>/dev/null \
      || docker compose -f docker-compose.production.yml down 2>/dev/null \
      || true
    ;;
  native)
    "${SCRIPT_DIR}/stop-services-testnet.sh" 2>/dev/null || true
    if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
      stop_by_pid_file indexer
      free_port 8800
      if [[ "$KEEP_POSTGRES" != "true" ]] && command -v docker >/dev/null 2>&1; then
        docker compose -f docker-compose.indexer.yml stop postgres 2>/dev/null || true
      fi
    fi
    if [[ "$PROFILE" == "full" ]]; then
      stop_by_pid_file pricing-engine
      free_port 8801
    fi
    ;;
  *)
    echo "Invalid mode: ${MODE}" >&2
    exit 1
    ;;
esac

echo "Done."
