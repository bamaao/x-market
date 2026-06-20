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

# 检查链下服务健康端点（P0 + 可选 P1）
param(
  [string]$KeeperUrl = "http://localhost:8788",
  [string]$MonitorUrl = "http://localhost:8789",
  [string]$RelayerUrl = "http://localhost:8790",
  [string]$WalrusRelayUrl = "http://localhost:8791",
  [string]$AuditKeeperUrl = "http://localhost:8792",
  [string]$ZkProverUrl = "http://localhost:8794",
  [switch]$IncludeP1,
  [switch]$IncludeP4,
  [switch]$IncludeZk
)

$ErrorActionPreference = "Stop"
$failed = @()

function Check-Health($name, $url) {
  try {
    $r = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 10
    if ($r.ok) {
      Write-Host "[OK] $name $url" -ForegroundColor Green
      Write-Host "     $($r | ConvertTo-Json -Compress)"
      return $true
    }
    Write-Host "[WARN] $name unhealthy: $($r.errors -join '; ')" -ForegroundColor Yellow
    Write-Host "     $($r | ConvertTo-Json -Compress)"
    return $false
  } catch {
    Write-Host "[FAIL] $name $url — $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

if (-not (Check-Health "lp-guard-keeper" $KeeperUrl)) { $failed += "lp-guard-keeper" }

if ($IncludeP1) {
  if (-not (Check-Health "chain-monitor" $MonitorUrl)) { $failed += "chain-monitor" }
  if (-not (Check-Health "oracle-relayer" $RelayerUrl)) { $failed += "oracle-relayer" }
  if (-not (Check-Health "walrus-relay" $WalrusRelayUrl)) { $failed += "walrus-relay" }
}

if ($IncludeP4) {
  if (-not (Check-Health "prophet-audit-keeper" $AuditKeeperUrl)) { $failed += "prophet-audit-keeper" }
}

if ($IncludeZk) {
  if (-not (Check-Health "brevis-zk-prover" $ZkProverUrl)) { $failed += "brevis-zk-prover" }
}

if ($failed.Count -gt 0) {
  Write-Host "Unhealthy: $($failed -join ', '). Logs: .run/*.log"
  exit 1
}
Write-Host "All services healthy."
exit 0
