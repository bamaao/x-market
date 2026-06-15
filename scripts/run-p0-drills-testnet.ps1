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

# P0.7 Testnet 应急演练：前置检查 + 链上自动化 + 服务健康
param(
  [switch]$SkipPreflight,
  [switch]$SkipServices
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== P0.7 Emergency Drills (Testnet) ===" -ForegroundColor Cyan

if (-not $SkipPreflight) {
  & "$PSScriptRoot\verify-p0-readiness.ps1" -SkipMoveTest
  if ($LASTEXITCODE -ne 0) { exit 1 }
  & "$PSScriptRoot\verify-governance-params.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

if (-not $SkipServices) {
  if (-not (Test-Path "services/gas-station/.env.local")) {
    Write-Host "Bootstrapping service env..."
    & "$PSScriptRoot\bootstrap-services-env.ps1"
  }
  & "$PSScriptRoot\verify-services-health.ps1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting services..."
    & "$PSScriptRoot\start-services-testnet.ps1" -SkipInstall
  }
}

Write-Host ""
Write-Host "Stopping chain services to avoid wallet object version races..." -ForegroundColor Yellow
& "$PSScriptRoot\stop-services-testnet.ps1"

Write-Host ""
Write-Host "Running on-chain drills (A-D)..." -ForegroundColor Cyan
Push-Location app
try {
  npx tsx scripts/p0-drills.ts
  $drillExit = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($drillExit -ne 0) {
  Write-Host "Drill script reported failures — see docs/mainnet-drill-2026-06-06.md" -ForegroundColor Red
  exit 1
}

if (-not $SkipServices) {
  Write-Host ""
  Write-Host "Restarting services..." -ForegroundColor Cyan
  & "$PSScriptRoot\start-services-testnet.ps1" -SkipInstall
}

Write-Host ""
Write-Host "Drills complete. Record: docs/mainnet-drill-2026-06-06.md" -ForegroundColor Green
Write-Host "Manual follow-ups: B unslash (1800s) · D finalize (3600s) · A claim after maturity · E/F checklist"
