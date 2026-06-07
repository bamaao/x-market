#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

PROFILE="full"
KEEP_POSTGRES=false

usage() {
  echo "Usage: $0 [--profile frontend|p0|p1|p2|full] [--keep-postgres]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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
      exit 1
      ;;
  esac
done

echo "=== Stopping Testnet environment (profile=${PROFILE}) ==="

if [[ "$PROFILE" != "frontend" ]]; then
  "${SCRIPT_DIR}/stop-services-testnet.sh"
fi

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  stop_by_pid_file indexer
  free_port 8800
  if [[ "$KEEP_POSTGRES" != "true" ]] && command -v docker >/dev/null 2>&1; then
    docker compose -f docker-compose.indexer.yml stop postgres 2>/dev/null || true
    echo "Stopped Docker Postgres"
  elif [[ "$KEEP_POSTGRES" == "true" ]]; then
    echo "Keeping Postgres running (--keep-postgres)"
  fi
fi

if [[ "$PROFILE" == "full" ]]; then
  stop_by_pid_file pricing-engine
  free_port 8801
fi

echo "Done."
