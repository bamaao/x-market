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

# X-Market 前端部署到 Vercel
#
# 前置：npm i -g vercel && vercel login
#
# 用法:
#   ./scripts/deploy-frontend-vercel.sh \
#     --frontend-url https://x-market.vercel.app \
#     --api-base-url https://api.example.com \
#     --prod
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/production-common.sh
source "${SCRIPT_DIR}/lib/production-common.sh"

PROD=false
SKIP_ENV_SYNC=false
VERCEL_TOKEN="${VERCEL_TOKEN:-}"
VERCEL_ORG="${VERCEL_ORG:-}"
VERCEL_PROJECT="${VERCEL_PROJECT:-}"

usage() {
  cat <<EOF
Usage: $0 --frontend-url URL --api-base-url URL [OPTIONS]

Required:
  --frontend-url URL     目标 Vercel 域名（用于生成 env 与校验）
  --api-base-url URL     后端 API 公网地址

Options:
  --profile PROFILE      p1 | p2 | full  (default: p2)
  --api-routing MODE     path | direct | vercel-proxy
  --backend-host IP      vercel-proxy 时必填（公网 IP，仅 Vercel 服务端）
  --deploy-json PATH
  --prod                 vercel deploy --prod
  --skip-env-sync        不推送环境变量到 Vercel（仅 deploy）
  --vercel-org SLUG      Vercel team/user slug
  --vercel-project NAME  Vercel 项目名
  -h, --help

Environment:
  VERCEL_TOKEN           CI/CD 非交互部署 token
EOF
}

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
    --prod)
      PROD=true
      shift
      ;;
    --skip-env-sync)
      SKIP_ENV_SYNC=true
      shift
      ;;
    --vercel-org)
      VERCEL_ORG="$2"
      shift 2
      ;;
    --vercel-project)
      VERCEL_PROJECT="$2"
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

PROFILE="${PROFILE:-p2}"
require_url "FRONTEND_URL" "$FRONTEND_URL"

if [[ "$API_ROUTING" == "vercel-proxy" ]]; then
  [[ -n "$BACKEND_PROXY_HOST" ]] || {
    echo "vercel-proxy requires --backend-host or XMARKET_BACKEND_PROXY_HOST" >&2
    exit 1
  }
  API_BASE_URL="${API_BASE_URL:-$FRONTEND_URL}"
else
  require_url "API_BASE_URL" "$API_BASE_URL"
fi
require_cmd npm

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install: npm i -g vercel" >&2
  exit 1
fi

FRONTEND_URL="$(strip_trailing_slash "$FRONTEND_URL")"
API_BASE_URL="$(strip_trailing_slash "$API_BASE_URL")"

echo "=== X-Market Frontend Deploy (Vercel) ==="

bootstrap_args=(
  --frontend-url "$FRONTEND_URL"
  --api-base-url "$API_BASE_URL"
  --api-routing "$API_ROUTING"
  --profile "$PROFILE"
  --deploy-json "$DEPLOY_JSON"
)
[[ -n "$BACKEND_PROXY_HOST" ]] && bootstrap_args+=(--backend-host "$BACKEND_PROXY_HOST")
"${SCRIPT_DIR}/bootstrap-production-env.sh" "${bootstrap_args[@]}"

ENV_FILE="${XMARKET_ROOT}/deploy/vercel.env.generated"
SERVER_ENV_FILE="${XMARKET_ROOT}/deploy/vercel.server.env.generated"
[[ -f "$ENV_FILE" ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }

sync_vercel_env_file() {
  local file="$1"
  local env_target="$2"
  [[ -f "$file" ]] || return 0
  (
    cd app
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      key="${line%%=*}"
      value="${line#*=}"
      [[ -z "$key" ]] && continue
      echo "  ${key} → ${env_target}"
      vercel env rm "$key" "$env_target" "${scope_args[@]}" --yes 2>/dev/null || true
      printf '%s' "$value" | vercel env add "$key" "$env_target" "${scope_args[@]}" --force --yes
    done <"$file"
  )
}

if [[ "$SKIP_ENV_SYNC" != "true" ]]; then
  echo "Syncing environment variables to Vercel ..."
  env_target="preview"
  [[ "$PROD" == "true" ]] && env_target="production"
  scope_args=()
  [[ -n "$VERCEL_TOKEN" ]] && scope_args+=(--token "$VERCEL_TOKEN")
  [[ -n "$VERCEL_ORG" ]] && scope_args+=(--scope "$VERCEL_ORG")

  sync_vercel_env_file "$ENV_FILE" "$env_target"
  sync_vercel_env_file "$SERVER_ENV_FILE" "$env_target"
fi

echo "npm install: app/"
(cd app && npm install --silent)

deploy_args=(deploy)
[[ "$PROD" == "true" ]] && deploy_args+=(--prod)
[[ -n "$VERCEL_TOKEN" ]] && deploy_args+=(--token "$VERCEL_TOKEN")
[[ -n "$VERCEL_ORG" ]] && deploy_args+=(--scope "$VERCEL_ORG")
[[ -n "$VERCEL_PROJECT" ]] && deploy_args+=(--name "$VERCEL_PROJECT")

echo "Running vercel ${deploy_args[*]} (cwd=app) ..."
(
  cd app
  vercel "${deploy_args[@]}"
)

echo ""
echo "=== Vercel deploy complete ==="
echo "Frontend: ${FRONTEND_URL}"
echo "Ensure Vercel project Root Directory is set to 'app' (or run from app/ as this script does)."
echo "GeoBlock: set GEO_BLOCK_ENABLED / GEO_BLOCKED_COUNTRIES in Vercel dashboard if needed."
