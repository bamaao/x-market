#!/usr/bin/env bash
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
