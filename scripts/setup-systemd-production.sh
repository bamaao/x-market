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

# 为非 Docker 生产部署安装 systemd 单元
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

PROFILE="p2"
RUN_USER="${SUDO_USER:-$USER}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --user)
      RUN_USER="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--profile p1|p2|full] [--user ubuntu]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

services=(gas-station lp-guard-keeper chain-monitor oracle-relayer walrus-relay)
if [[ "$PROFILE" == "p2" || "$PROFILE" == "full" ]]; then
  services+=(indexer)
fi
if [[ "$PROFILE" == "full" ]]; then
  services+=(pricing-engine)
fi

write_unit() {
  local name="$1"
  local work_rel="$2"
  local unit="/etc/systemd/system/x-market-${name}.service"

  $SUDO tee "$unit" >/dev/null <<EOF
[Unit]
Description=X-Market ${name} (production native)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${XMARKET_ROOT}/${work_rel}
EnvironmentFile=${XMARKET_ROOT}/${work_rel}/.env.local
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:${XMARKET_ROOT}/.run/${name}.log
StandardError=append:${XMARKET_ROOT}/.run/${name}.log

[Install]
WantedBy=multi-user.target
EOF
  echo "Installed ${unit}"
}

mkdir -p "$RUN_DIR"

for svc in "${services[@]}"; do
  case "$svc" in
    pricing-engine) work_rel="pricing-engine" ;;
    *) work_rel="services/${svc}" ;;
  esac
  [[ -f "${XMARKET_ROOT}/${work_rel}/.env.local" ]] || {
    echo "Missing ${work_rel}/.env.local" >&2
    exit 1
  }
  write_unit "$svc" "$work_rel"
done

$SUDO systemctl daemon-reload
for svc in "${services[@]}"; do
  $SUDO systemctl enable "x-market-${svc}.service"
  $SUDO systemctl restart "x-market-${svc}.service" || true
done

echo ""
echo "systemd units enabled. Status:"
for svc in "${services[@]}"; do
  $SUDO systemctl --no-pager -l status "x-market-${svc}.service" | head -5 || true
  echo ""
done
