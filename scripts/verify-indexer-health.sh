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

require_cmd curl

INDEXER_URL="${INDEXER_URL:-http://localhost:8800}"

if check_health indexer "$INDEXER_URL"; then
  for ep in /v1/markets /v1/feeds /v1/prophet/leaderboard; do
    if curl -sf --max-time 15 "${INDEXER_URL}${ep}" >/dev/null; then
      echo "[OK] GET ${ep}"
    else
      echo "[WARN] GET ${ep}"
    fi
  done
  exit 0
fi

echo "Log: .run/indexer.log" >&2
exit 1
