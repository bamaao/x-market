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

# Ubuntu 24.04 一次性安装 Testnet 部署依赖
set -euo pipefail

INSTALL_SUI=false
INSTALL_DOCKER=false

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Installs base packages for X-Market Testnet deployment on Ubuntu 24.04.

Options:
  --with-sui       Also install Sui CLI (via suiup)
  --with-docker    Also install Docker Engine + compose plugin
  -h, --help       Show this help

Default: nodejs, npm, curl, git, python3, lsof, build-essential
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-sui)
      INSTALL_SUI=true
      shift
      ;;
    --with-docker)
      INSTALL_DOCKER=true
      shift
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

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

echo "=== Installing Ubuntu 24.04 prerequisites ==="

$SUDO apt-get update
$SUDO apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsof \
  python3 \
  build-essential

# Node.js 20 LTS via NodeSource
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.version.split(".")[0].slice(1)' 2>/dev/null || echo 0)" -lt 20 ]]; then
  echo "Installing Node.js 20 ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

if [[ "$INSTALL_DOCKER" == "true" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Installing Docker Engine ..."
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO usermod -aG docker "${SUDO_USER:-$USER}" 2>/dev/null || true
    echo "NOTE: log out and back in (or newgrp docker) for docker group membership."
  else
    echo "Docker already installed: $(docker --version)"
  fi
fi

if [[ "$INSTALL_SUI" == "true" ]]; then
  if ! command -v sui >/dev/null 2>&1; then
    echo "Installing Sui CLI via suiup ..."
    curl -fsSL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
    export PATH="${HOME}/.local/bin:${PATH}"
    if command -v suiup >/dev/null 2>&1; then
      suiup install sui --testnet
    else
      echo "WARN: suiup install failed — install Sui manually: https://docs.sui.io/guides/developer/getting-started/sui-install" >&2
    fi
  else
    echo "Sui already installed: $(sui --version 2>/dev/null || sui client --version)"
  fi
fi

echo ""
echo "=== Done ==="
echo "Next steps:"
echo "  git clone <repo> && cd x-market-sui"
echo "  sui client switch --env testnet"
echo "  ./scripts/fund-gas-payer-testnet.sh"
echo "  ./scripts/deploy-testnet.sh --profile p1"
echo ""
echo "Full guide: docs/testnet-deployment-ubuntu.md"
