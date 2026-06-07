#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

require_cmd curl

GAS_STATION_URL="${GAS_STATION_URL:-http://localhost:8787}"
KEEPER_URL="${KEEPER_URL:-http://localhost:8788}"
MONITOR_URL="${MONITOR_URL:-http://localhost:8789}"
RELAYER_URL="${RELAYER_URL:-http://localhost:8790}"
WALRUS_RELAY_URL="${WALRUS_RELAY_URL:-http://localhost:8791}"
AUDIT_KEEPER_URL="${AUDIT_KEEPER_URL:-http://localhost:8792}"
INCLUDE_P1=false
INCLUDE_P4=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-p1)
      INCLUDE_P1=true
      shift
      ;;
    --include-p4)
      INCLUDE_P4=true
      shift
      ;;
    -h | --help)
      echo "Usage: $0 [--include-p1] [--include-p4]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

failed=()

check_health gas-station "$GAS_STATION_URL" || failed+=(gas-station)
check_health lp-guard-keeper "$KEEPER_URL" || failed+=(lp-guard-keeper)

if [[ "$INCLUDE_P1" == "true" ]]; then
  check_health chain-monitor "$MONITOR_URL" || failed+=(chain-monitor)
  check_health oracle-relayer "$RELAYER_URL" || failed+=(oracle-relayer)
  check_health walrus-relay "$WALRUS_RELAY_URL" || failed+=(walrus-relay)
fi

if [[ "$INCLUDE_P4" == "true" ]]; then
  check_health prophet-audit-keeper "$AUDIT_KEEPER_URL" || failed+=(prophet-audit-keeper)
fi

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Unhealthy: ${failed[*]}. Logs: .run/*.log" >&2
  exit 1
fi

echo "All services healthy."
exit 0
