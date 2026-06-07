#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/testnet-common.sh
source "${SCRIPT_DIR}/lib/testnet-common.sh"

for name in gas-station lp-guard-keeper chain-monitor oracle-relayer walrus-relay prophet-audit-keeper; do
  stop_by_pid_file "$name"
done

for port in 8787 8788 8789 8790 8791 8792; do
  free_port "$port"
done

echo "All chain services stopped."
