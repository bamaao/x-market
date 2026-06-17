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

# 生产后端部署公共逻辑（Docker / Native 共用）
set -euo pipefail

_backend_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_SCRIPT_DIR="$(cd "${_backend_common_dir}/.." && pwd)"
# shellcheck source=production-common.sh
source "${_backend_common_dir}/production-common.sh"

PROFILE="p2"
SKIP_BOOTSTRAP=false
SKIP_BUILD=false
INSTALL_DEPS=false
SETUP_NGINX=false
SETUP_SSL=false
SETUP_SYSTEMD=false
API_DOMAIN=""
SSL_EMAIL=""
DRY_RUN_KEEPER=false
API_ROUTING="path"
RUNTIME="docker"
POSTGRES_MODE="docker"
SKIP_INSTALL=false
EXPOSE_PUBLIC_PORTS=false
DEPLOY_MODE_NAME="docker"

deploy_backend_usage() {
  local mode_hint="${1:-docker|native}"
  cat <<EOF
Usage: $0 --frontend-url URL --api-base-url URL [OPTIONS]

Required:
  --frontend-url URL      Vercel 前端地址（CORS）
  --api-base-url URL      对外 API 地址

Options:
  --profile PROFILE       p1 | p2 | full  (default: p2)
  --api-routing MODE      path | direct | vercel-proxy  (default: path)
  --backend-host IP         vercel-proxy：后端公网 IP（仅 Vercel 可见）
  --expose-public-ports     暴露 Docker 端口到公网（vercel-proxy 时建议开启）
  --deploy-json PATH      deploy/testnet-v2.json
  --install-deps          安装系统依赖
  --setup-nginx           安装并配置 Nginx（需 --api-domain）
  --api-domain DOMAIN     Nginx server_name
  --setup-ssl             certbot HTTPS（需 --ssl-email）
  --ssl-email EMAIL
  --dry-run-keeper        LP Guard 仅观测
  --skip-bootstrap        跳过环境生成
  --skip-install          跳过 npm install（仅 native）
  --skip-build            跳过 docker build（仅 docker）
  --setup-systemd         安装 systemd 单元（仅 native）
  --postgres-mode MODE    docker | native | external（仅 native，default: docker）
  -h, --help

Mode: ${mode_hint}

Secrets:
  XMARKET_DEPLOYER_PRIVATE_KEY
  XMARKET_DEPLOYER_PRIVATE_KEY_FILE
  XMARKET_INDEXER_DATABASE_URL   （postgres-mode=external 时必填）
EOF
}

parse_deploy_backend_args() {
  local allowed_mode="${1:-}"
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --frontend-url)
        FRONTEND_URL="$2"
        shift 2
        ;;
      --api-base-url)
        API_BASE_URL="$2"
        shift 2
        ;;
      --api-routing)
        API_ROUTING="$2"
        shift 2
        ;;
      --backend-host)
        BACKEND_PROXY_HOST="$2"
        shift 2
        ;;
      --profile)
        PROFILE="$2"
        shift 2
        ;;
      --deploy-json)
        DEPLOY_JSON="$2"
        shift 2
        ;;
      --install-deps)
        INSTALL_DEPS=true
        shift
        ;;
      --setup-nginx)
        SETUP_NGINX=true
        shift
        ;;
      --api-domain)
        API_DOMAIN="$2"
        shift 2
        ;;
      --setup-ssl)
        SETUP_SSL=true
        shift
        ;;
      --ssl-email)
        SSL_EMAIL="$2"
        shift 2
        ;;
      --dry-run-keeper)
        DRY_RUN_KEEPER=true
        shift
        ;;
      --skip-bootstrap)
        SKIP_BOOTSTRAP=true
        shift
        ;;
      --skip-build)
        SKIP_BUILD=true
        shift
        ;;
      --expose-public-ports)
        EXPOSE_PUBLIC_PORTS=true
        shift
        ;;
      --skip-install)
        SKIP_INSTALL=true
        shift
        ;;
      --setup-systemd)
        SETUP_SYSTEMD=true
        shift
        ;;
      --postgres-mode)
        POSTGRES_MODE="$2"
        shift 2
        ;;
      -h | --help)
        deploy_backend_usage "$allowed_mode"
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        deploy_backend_usage "$allowed_mode" >&2
        exit 1
        ;;
    esac
  done
}

validate_deploy_backend_args() {
  require_url "FRONTEND_URL" "$FRONTEND_URL"

  if [[ "$API_ROUTING" == "vercel-proxy" ]]; then
    [[ -n "$BACKEND_PROXY_HOST" ]] || {
      echo "vercel-proxy requires --backend-host or XMARKET_BACKEND_PROXY_HOST" >&2
      exit 1
    }
    API_BASE_URL="${API_BASE_URL:-$FRONTEND_URL}"
    EXPOSE_PUBLIC_PORTS=true
  else
    require_url "API_BASE_URL" "$API_BASE_URL"
  fi

  require_cmd curl

  case "$PROFILE" in
    p1 | p2 | full) ;;
    *)
      echo "Invalid profile: ${PROFILE}" >&2
      exit 1
      ;;
  esac

  case "$POSTGRES_MODE" in
    docker | native | external) ;;
    *)
      echo "Invalid postgres-mode: ${POSTGRES_MODE}" >&2
      exit 1
      ;;
  esac

  if [[ "$API_ROUTING" == "path" && "$SETUP_NGINX" != "true" ]]; then
    echo "WARN: api-routing=path 但未 --setup-nginx；请确保已手动配置反向代理。" >&2
  fi

  if [[ "$API_ROUTING" == "vercel-proxy" && "$SETUP_NGINX" == "true" ]]; then
    echo "WARN: vercel-proxy 模式无需 Nginx，已忽略 --setup-nginx。" >&2
    SETUP_NGINX=false
  fi

  if [[ "$SETUP_NGINX" == "true" && -z "$API_DOMAIN" ]]; then
    echo "--setup-nginx requires --api-domain" >&2
    exit 1
  fi

  if [[ "$POSTGRES_MODE" == "external" && -z "${XMARKET_INDEXER_DATABASE_URL:-}" ]]; then
    echo "postgres-mode=external requires XMARKET_INDEXER_DATABASE_URL" >&2
    exit 1
  fi
}

run_production_bootstrap() {
  if [[ "$SKIP_BOOTSTRAP" == "true" ]]; then
    echo "Skipping bootstrap (using existing .env.local files)"
    return 0
  fi

  local bootstrap_args=(
    --frontend-url "$FRONTEND_URL"
    --api-base-url "$API_BASE_URL"
    --api-routing "$API_ROUTING"
    --profile "$PROFILE"
    --deploy-json "$DEPLOY_JSON"
    --runtime "$RUNTIME"
    --postgres-mode "$POSTGRES_MODE"
  )
  [[ -n "$BACKEND_PROXY_HOST" ]] && bootstrap_args+=(--backend-host "$BACKEND_PROXY_HOST")
  [[ "$DRY_RUN_KEEPER" == "true" ]] && bootstrap_args+=(--dry-run-keeper)
  "${BACKEND_SCRIPT_DIR}/bootstrap-production-env.sh" "${bootstrap_args[@]}"
}

run_nginx_setup() {
  [[ "$SETUP_NGINX" != "true" ]] && return 0
  local nginx_args=(--api-domain "$API_DOMAIN")
  [[ "$SETUP_SSL" == "true" ]] && nginx_args+=(--setup-ssl --ssl-email "$SSL_EMAIL")
  "${BACKEND_SCRIPT_DIR}/setup-nginx-api.sh" "${nginx_args[@]}"
}

verify_backend_health() {
  local verify_fail=false

  if ! check_health gas-station "http://127.0.0.1:8787"; then verify_fail=true; fi
  if ! check_health lp-guard-keeper "http://127.0.0.1:8788"; then verify_fail=true; fi
  if [[ "$PROFILE" == "p1" || "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
    check_health chain-monitor "http://127.0.0.1:8789" || verify_fail=true
    check_health oracle-relayer "http://127.0.0.1:8790" || verify_fail=true
    check_health walrus-relay "http://127.0.0.1:8791" || verify_fail=true
  fi
  if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
    check_health indexer "http://127.0.0.1:8800" || verify_fail=true
  fi
  if [[ "$PROFILE" == "full" ]]; then
    check_health pricing-engine "http://127.0.0.1:8801" || verify_fail=true
  fi

  if [[ "$API_ROUTING" == "path" && -n "$API_DOMAIN" ]]; then
    local scheme="http"
    [[ "$SETUP_SSL" == "true" ]] && scheme="https"
    echo ""
    echo "Public API checks (${scheme}://${API_DOMAIN}):"
    curl -sf --max-time 15 "${scheme}://${API_DOMAIN}/gas/health" >/dev/null && echo "[OK] /gas/health" || verify_fail=true
    if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
      curl -sf --max-time 15 "${scheme}://${API_DOMAIN}/indexer/health" >/dev/null && echo "[OK] /indexer/health" || verify_fail=true
    fi
  fi

  [[ "$verify_fail" != "true" ]]
}

print_deploy_summary() {
  local stop_hint="$1"
  echo ""
  echo "=== Backend deploy complete (${DEPLOY_MODE_NAME}, profile=${PROFILE}) ==="
  echo ""
  echo "Public endpoints (Vercel NEXT_PUBLIC_*):"
  echo "  GAS_STATION:  $(service_public_url gas)"
  echo "  INDEXER:      $(service_public_url indexer)"
  if [[ "$PROFILE" == "full" ]]; then
    echo "  PRICING:      $(service_public_url pricing)"
  fi
  echo ""
  echo "Vercel env file: deploy/vercel.env.generated"
  if [[ "$API_ROUTING" == "vercel-proxy" ]]; then
    echo "Next: ./scripts/deploy-frontend-vercel.sh --frontend-url ${FRONTEND_URL} \\"
    echo "        --api-routing vercel-proxy --backend-host ${BACKEND_PROXY_HOST} --prod"
  else
    echo "Next: ./scripts/deploy-frontend-vercel.sh --frontend-url ${FRONTEND_URL} --api-base-url ${API_BASE_URL}"
  fi
  echo ""
  echo "Stop: ${stop_hint}"
  echo "Docs: docs/production-deployment.zh.md"
}
