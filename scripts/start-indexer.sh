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

SKIP_INSTALL=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    -h | --help)
      echo "Usage: $0 [--skip-install]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

[[ -f services/indexer/.env.local ]] || "${SCRIPT_DIR}/bootstrap-indexer-env.sh"

if [[ "$SKIP_INSTALL" != "true" ]]; then
  install_shared_npm_deps
  echo "npm install: services/indexer"
  (cd services/indexer && npm install --silent)
fi

start_npm_service indexer "${XMARKET_ROOT}/services/indexer"

sleep 5
"${SCRIPT_DIR}/verify-indexer-health.sh"
