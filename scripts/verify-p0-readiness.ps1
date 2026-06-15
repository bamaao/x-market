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

# P0 主网前自动化检查（不含外部审计）
# 用法: .\scripts\verify-p0-readiness.ps1 [-SkipMoveTest] [-CheckServices]
param(
  [switch]$SkipMoveTest,
  [switch]$CheckServices
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$failed = @()
$passed = @()

function Assert-Ok($name, $scriptBlock) {
  try {
    & $scriptBlock
    $script:passed += $name
    Write-Host "[OK] $name" -ForegroundColor Green
  } catch {
    $script:failed += $name
    Write-Host "[FAIL] $name — $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "=== X-Market P0 Readiness Check ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "Commit: $(git rev-parse HEAD 2>$null)"
Write-Host ""

Assert-Ok "docs/mainnet-infra-priority.md exists" {
  if (-not (Test-Path "docs/mainnet-infra-priority.md")) { throw "missing" }
}

Assert-Ok "docs/mainnet-governance-params.md exists" {
  if (-not (Test-Path "docs/mainnet-governance-params.md")) { throw "missing" }
}

Assert-Ok "docs/governance-params-baseline.json exists" {
  if (-not (Test-Path "docs/governance-params-baseline.json")) { throw "missing" }
}

Assert-Ok "verify-governance-params.ps1" {
  & "$PSScriptRoot\verify-governance-params.ps1"
  if ($LASTEXITCODE -ne 0) { throw "governance params mismatch" }
}

Assert-Ok "sui move build" {
  sui move build *> $null
  if ($LASTEXITCODE -ne 0) { throw "build failed (exit $LASTEXITCODE)" }
}

if (-not $SkipMoveTest) {
  Assert-Ok "sui move test" {
    sui move test *> $null
    if ($LASTEXITCODE -ne 0) { throw "tests failed (exit $LASTEXITCODE)" }
  }
} else {
  Write-Host "[SKIP] sui move test" -ForegroundColor Yellow
}

Assert-Ok "gas-station typecheck" {
  Push-Location services/gas-station
  try {
    npm run typecheck 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
  } finally {
    Pop-Location
  }
}

Assert-Ok "lp-guard-keeper test + typecheck" {
  Push-Location services/lp-guard-keeper
  try {
    npm test 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "tests failed" }
    npm run typecheck 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
  } finally {
    Pop-Location
  }
}

Assert-Ok "gas-station .env.example" {
  if (-not (Test-Path "services/gas-station/.env.example")) { throw "missing" }
}

Assert-Ok "lp-guard-keeper .env.example" {
  if (-not (Test-Path "services/lp-guard-keeper/.env.example")) { throw "missing" }
}

if ($CheckServices) {
  Assert-Ok "gas-station /health" {
    $r = Invoke-RestMethod -Uri "http://localhost:8787/health" -TimeoutSec 5
    if (-not $r.service) { throw "unexpected response" }
    if (-not $r.ok) {
      Write-Host "  health warnings: $($r.errors -join '; ')" -ForegroundColor Yellow
    }
  }

  Assert-Ok "lp-guard-keeper /health" {
    $r = Invoke-RestMethod -Uri "http://localhost:8788/health" -TimeoutSec 5
    if (-not $r.service) { throw "unexpected response" }
    if (-not $r.ok) {
      Write-Host "  health warnings: $($r.errors -join '; ')" -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $($passed.Count)"
Write-Host "Failed: $($failed.Count)"

if ($failed.Count -gt 0) {
  Write-Host "Failed items:" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

Write-Host "P0 automated checks passed. Manual items remain: audit (0.1), mainnet publish (0.2), governance sign-off (0.6), drills (0.7)." -ForegroundColor Green
exit 0
