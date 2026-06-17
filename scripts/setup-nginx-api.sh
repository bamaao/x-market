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

# 在 Ubuntu 24.04 上安装 Nginx 并配置 API 反向代理（path 路由）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

API_DOMAIN=""
SETUP_SSL=false
SSL_EMAIL=""

usage() {
  cat <<EOF
Usage: $0 --api-domain DOMAIN [OPTIONS]

Options:
  --api-domain DOMAIN   API 域名，如 api.example.com
  --setup-ssl           使用 certbot 申请 Let's Encrypt 证书
  --ssl-email EMAIL     certbot 注册邮箱（--setup-ssl 时必填）
  -h, --help            Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

[[ -n "$API_DOMAIN" ]] || { echo "--api-domain is required" >&2; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

echo "=== Installing Nginx ==="
$SUDO apt-get update
$SUDO apt-get install -y nginx

template="${XMARKET_ROOT}/deploy/nginx/api.conf.template"
out="/etc/nginx/sites-available/x-market-api.conf"
rendered="$(mktemp)"
sed "s/__API_DOMAIN__/${API_DOMAIN}/g" "$template" >"$rendered"

echo "=== Writing ${out} ==="
$SUDO cp "$rendered" "$out"
rm -f "$rendered"
$SUDO ln -sf /etc/nginx/sites-available/x-market-api.conf /etc/nginx/sites-enabled/x-market-api.conf
$SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

$SUDO nginx -t
$SUDO systemctl enable nginx
$SUDO systemctl reload nginx

if [[ "$SETUP_SSL" == "true" ]]; then
  [[ -n "$SSL_EMAIL" ]] || { echo "--ssl-email required with --setup-ssl" >&2; exit 1; }
  echo "=== Certbot SSL ==="
  $SUDO apt-get install -y certbot python3-certbot-nginx
  $SUDO certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"
fi

echo ""
echo "Nginx configured for ${API_DOMAIN}"
echo "  https://${API_DOMAIN}/gas/health"
echo "  https://${API_DOMAIN}/indexer/health"
echo "  https://${API_DOMAIN}/pricing/health"
