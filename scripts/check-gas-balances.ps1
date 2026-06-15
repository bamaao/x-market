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

# P1.7 检查 Gas Payer / Keeper SUI 余额（通过 /health）
param(
  [string]$GasStationUrl = "http://localhost:8787",
  [string]$KeeperUrl = "http://localhost:8788",
  [switch]$FailOnLow
)

$ErrorActionPreference = "Stop"
$issues = @()

function Read-Health($name, $url) {
  try {
    return Invoke-RestMethod -Uri "$url/health" -TimeoutSec 10
  } catch {
    Write-Host "[FAIL] $name — $($_.Exception.Message)" -ForegroundColor Red
    $script:issues += "$name unreachable"
    return $null
  }
}

$gas = Read-Health "gas-station" $GasStationUrl
if ($gas) {
  $sui = if ($gas.gasBalanceMist) { [double]$gas.gasBalanceMist / 1e9 } else { 0 }
  Write-Host "Gas Station: $($gas.gasOwner) balance=$([math]::Round($sui, 4)) SUI low=$($gas.gasBalanceLow)"
  if ($gas.gasBalanceLow) { $issues += "gas-station balance low" }
}

$keeper = Read-Health "lp-guard-keeper" $KeeperUrl
if ($keeper) {
  $sui = if ($keeper.gasBalanceMist) { [double]$keeper.gasBalanceMist / 1e9 } else { 0 }
  Write-Host "Keeper: $($keeper.keeper) balance=$([math]::Round($sui, 4)) SUI low=$($keeper.gasBalanceLow)"
  if ($keeper.gasBalanceLow) { $issues += "keeper balance low" }
}

if ($issues.Count -gt 0) {
  Write-Host "Issues: $($issues -join '; ')" -ForegroundColor Yellow
  if ($FailOnLow) { exit 1 }
}
exit 0
