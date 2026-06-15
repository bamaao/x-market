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

# P2 Indexer 完整就绪检查
param(
  [switch]$SkipIndexer,
  [switch]$SkipPostgres
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$failed = 0

function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:failed++ }
function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }

Write-Host "=== P2 Indexer Readiness ===" -ForegroundColor Cyan

$required = @(
  "services/indexer/src/index.ts",
  "services/indexer/migrations/001_init.sql",
  "docs/p2-indexer-runbook.md",
  "app/src/lib/indexer.ts",
  "docker-compose.indexer.yml"
)
foreach ($f in $required) {
  if (Test-Path $f) { Ok $f } else { Fail "missing $f" }
}

Push-Location services/indexer
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "indexer typecheck" } else { Fail "indexer typecheck" }
Pop-Location

if (-not $SkipPostgres) {
  try {
    $pg = docker ps --filter "name=postgres" --format "{{.Names}}" 2>$null
    if ($pg) { Ok "postgres container" } else { Write-Host "[SKIP] postgres not running (docker)" -ForegroundColor Yellow }
  } catch {
    Write-Host "[SKIP] docker not available" -ForegroundColor Yellow
  }
}

if (-not $SkipIndexer) {
  if (Test-Path "services/indexer/.env.local") {
    & "$PSScriptRoot\verify-indexer-health.ps1"
    if ($LASTEXITCODE -ne 0) { $failed++ }
  } else {
    Write-Host "[SKIP] indexer not bootstrapped" -ForegroundColor Yellow
  }
}

if ($failed -gt 0) {
  Write-Host "P2 readiness: $failed issue(s)" -ForegroundColor Red
  exit 1
}
Write-Host "P2 readiness: pass" -ForegroundColor Green
exit 0
