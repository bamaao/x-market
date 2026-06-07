#!/usr/bin/env bash
# X-Market Testnet 测试环境一键部署（Ubuntu / Linux）
# 用法: ./scripts/deploy-testnet.sh [--profile p1|p0|p2|full|frontend] [--dry-run-keeper] [--skip-bootstrap]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

PROFILE="p1"
SKIP_BOOTSTRAP=false
SKIP_INSTALL=false
DRY_RUN_KEEPER=false
SKIP_POSTGRES=false

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --profile PROFILE     frontend | p0 | p1 | p2 | full  (default: p1)
  --skip-bootstrap      Skip env generation
  --skip-install        Skip npm install
  --dry-run-keeper      LP Guard Keeper dry-run only
  --skip-postgres       Skip Docker Postgres (P2+)
  --deploy-json PATH    Chain config (default: deploy/testnet-v2.json)
  -h, --help            Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --skip-bootstrap)
      SKIP_BOOTSTRAP=true
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --dry-run-keeper)
      DRY_RUN_KEEPER=true
      shift
      ;;
    --skip-postgres)
      SKIP_POSTGRES=true
      shift
      ;;
    --deploy-json)
      DEPLOY_JSON="$2"
      shift 2
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

case "$PROFILE" in
  frontend | p0 | p1 | p2 | full) ;;
  *)
    echo "Invalid profile: ${PROFILE}" >&2
    exit 1
    ;;
esac

echo "=== X-Market Testnet Deploy (profile=${PROFILE}) ==="
echo "Root: ${XMARKET_ROOT}"
echo ""

require_cmd node
require_cmd npm
require_cmd curl
[[ -f "$DEPLOY_JSON" ]] || { echo "Missing ${DEPLOY_JSON}" >&2; exit 1; }

if [[ "$SKIP_BOOTSTRAP" != "true" ]]; then
  if [[ "$PROFILE" == "frontend" ]]; then
    bootstrap_app_env "$PROFILE"
  else
    require_cmd sui
    echo "Bootstrapping service env from ${DEPLOY_JSON} ..."
    bootstrap_args=(--deploy-json "$DEPLOY_JSON")
    [[ "$DRY_RUN_KEEPER" == "true" ]] && bootstrap_args+=(--dry-run-keeper)
    "${SCRIPT_DIR}/bootstrap-services-env.sh" "${bootstrap_args[@]}"
    if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
      "${SCRIPT_DIR}/bootstrap-indexer-env.sh" --deploy-json "$DEPLOY_JSON"
    fi
  fi
elif [[ "$PROFILE" == "frontend" && ! -f app/.env.local ]]; then
  bootstrap_app_env "$PROFILE"
fi

if [[ "$SKIP_INSTALL" != "true" ]]; then
  echo "npm install: app/"
  (cd app && npm install --silent)
fi

if [[ "$PROFILE" == "frontend" ]]; then
  echo ""
  echo "Frontend ready. Start with:"
  echo "  cd app && npm run dev"
  echo "  → http://localhost:3000"
  exit 0
fi

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]] && [[ "$SKIP_POSTGRES" != "true" ]]; then
  require_cmd docker
  echo "Starting Postgres (docker compose) ..."
  docker compose -f docker-compose.indexer.yml up -d postgres
  wait_postgres_healthy 90
fi

start_args=()
[[ "$SKIP_INSTALL" == "true" ]] && start_args+=(--skip-install)
[[ "$PROFILE" == "p0" ]] && start_args+=(--p0-only)
[[ "$PROFILE" == "full" ]] && start_args+=(--include-p4)

echo "Starting chain services ..."
"${SCRIPT_DIR}/start-services-testnet.sh" "${start_args[@]}"

if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  idx_args=()
  [[ "$SKIP_INSTALL" == "true" ]] && idx_args+=(--skip-install)
  "${SCRIPT_DIR}/start-indexer.sh" "${idx_args[@]}"
fi

if [[ "$PROFILE" == "full" ]]; then
  pe_args=()
  [[ "$SKIP_INSTALL" == "true" ]] && pe_args+=(--skip-install)
  "${SCRIPT_DIR}/start-pricing-engine.sh" "${pe_args[@]}"
fi

echo ""
echo "Running verification ..."
if ! "${SCRIPT_DIR}/verify-testnet-deployment.sh" --profile "$PROFILE"; then
  echo "Verification reported issues — check logs in .run/" >&2
fi

echo ""
echo "=== Deploy complete (profile=${PROFILE}) ==="
echo ""
echo "Endpoints:"
if [[ "$PROFILE" != "frontend" ]]; then
  echo "  Gas Station      http://localhost:8787/health"
  echo "  LP Guard Keeper  http://localhost:8788/health"
fi
if [[ "$PROFILE" == "p1" || "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  echo "  Chain Monitor    http://localhost:8789/health"
  echo "  Oracle Relayer   http://localhost:8790/health"
  echo "  Walrus Relay     http://localhost:8791/health"
fi
if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  echo "  Indexer API      http://localhost:8800/health"
fi
if [[ "$PROFILE" == "full" ]]; then
  echo "  Pricing Engine   http://localhost:8801/health"
  echo "  Audit Keeper     http://localhost:8792/health"
fi
echo ""
echo "Start frontend (separate terminal):"
echo "  cd app && npm run dev"
echo "  → http://localhost:3000"
echo ""
echo "Stop all: ./scripts/stop-testnet.sh --profile ${PROFILE}"
echo "Docs:     docs/testnet-deployment-ubuntu.md"
