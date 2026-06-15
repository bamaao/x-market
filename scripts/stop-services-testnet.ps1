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

# 停止 Testnet 链下服务
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$runDir = Join-Path $root ".run"

foreach ($name in @("gas-station", "lp-guard-keeper", "chain-monitor", "oracle-relayer", "walrus-relay", "prophet-audit-keeper")) {
  $pidFile = Join-Path $runDir "$name.pid"
  if (-not (Test-Path $pidFile)) { continue }
  $procId = [int](Get-Content $pidFile)
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $procId -Force
    Write-Host "Stopped $name (pid $procId)"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(8787, 8788, 8789, 8790, 8791, 8792)) {
  $lines = netstat -ano | Select-String "LISTENING\s+$port\s"
  foreach ($line in $lines) {
    if ($line -match "\s+(\d+)\s*$") {
      $pid = [int]$Matches[1]
      if ($pid -gt 0) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Freed port $port (pid $pid)"
      }
    }
  }
}
