#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

PROFILE="p1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--profile frontend|p0|p1|p2|full]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "=== Verify Testnet deployment (profile=${PROFILE}) ==="
failed=()

if [[ "$PROFILE" == "frontend" ]]; then
  if [[ -f app/.env.local ]]; then
    echo "[OK] app/.env.local exists"
    exit 0
  fi
  echo "[FAIL] missing app/.env.local" >&2
  exit 1
fi

health_args=()
if [[ "$PROFILE" == "p1" || "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  health_args+=(--include-p1)
fi
if [[ "$PROFILE" == "full" ]]; then
  health_args+=(--include-p4)
fi

if [[ "$PROFILE" == "p0" ]]; then
  "${SCRIPT_DIR}/verify-services-health.sh" || failed+=(services)
else
  "${SCRIPT_DIR}/verify-services-health.sh" "${health_args[@]}" || failed+=(services)
fi

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  "${SCRIPT_DIR}/verify-indexer-health.sh" || failed+=(indexer)
fi

if [[ "$PROFILE" == "full" ]]; then
  check_health pricing-engine "http://localhost:8801" || failed+=(pricing-engine)
fi

if [[ -f app/.env.local ]]; then
  echo "[OK] app/.env.local exists"
else
  echo "[WARN] app/.env.local missing — run bootstrap or deploy-testnet.sh" >&2
fi

if [[ ${#failed[@]} -gt 0 ]]; then
  echo ""
  echo "Failed checks: ${failed[*]}" >&2
  echo "Logs: .run/*.log" >&2
  exit 1
fi

echo ""
echo "All checks passed for profile=${PROFILE}"
exit 0
