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

# X-Market 生产后端一键部署（Ubuntu 24.04）
# 支持 Docker 与非 Docker 两种模式
#
# 用法:
#   ./scripts/deploy-backend-ubuntu.sh --mode docker ...
#   ./scripts/deploy-backend-ubuntu.sh --mode native ...
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="docker"

usage() {
  cat <<EOF
Usage: $0 --mode docker|native [OPTIONS ...]

  docker  全栈 Docker Compose（默认，见 deploy-backend-ubuntu-docker.sh）
  native  Node.js 进程 + 可选 Docker Postgres（见 deploy-backend-ubuntu-native.sh）

Pass through options:
  --frontend-url URL
  --api-base-url URL
  --profile p1|p2|full
  ... (see ./scripts/deploy-backend-ubuntu-docker.sh --help)

Examples:
  $0 --mode docker --frontend-url https://app.vercel.app --api-base-url https://api.example.com \\
     --profile p2 --install-deps --setup-nginx --api-domain api.example.com

  $0 --mode native --frontend-url https://app.vercel.app --api-base-url https://api.example.com \\
     --profile p2 --postgres-mode docker --setup-systemd
EOF
}

args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done

case "$MODE" in
  docker)
    exec "${SCRIPT_DIR}/deploy-backend-ubuntu-docker.sh" "${args[@]}"
    ;;
  native)
    exec "${SCRIPT_DIR}/deploy-backend-ubuntu-native.sh" "${args[@]}"
    ;;
  *)
    echo "Invalid --mode: ${MODE} (use docker or native)" >&2
    usage >&2
    exit 1
    ;;
esac
