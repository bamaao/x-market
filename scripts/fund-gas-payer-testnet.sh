#!/usr/bin/env bash
# Testnet：为当前活跃地址申请 faucet SUI
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

require_cmd sui

ADDRESS="${1:-$(sui client active-address | tr -d '[:space:]')}"
echo "Requesting testnet SUI for ${ADDRESS} ..."
sui client faucet --address "$ADDRESS"
echo "Done. Check balance: sui client gas"
