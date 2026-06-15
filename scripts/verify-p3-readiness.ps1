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

# P3 增长期就绪检查
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$failed = 0

function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:failed++ }
function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }

Write-Host "=== P3 Readiness ===" -ForegroundColor Cyan

@(
  "app/src/app/roi/page.tsx",
  "app/src/middleware.ts",
  "pricing-engine/src/quote.ts",
  "services/indexer/migrations/002_p3.sql",
  "services/indexer/src/workers/seal-cache.ts",
  "docs/p3-growth-runbook.md",
  "scripts/bootstrap-mobile-env.ps1"
) | ForEach-Object {
  if (Test-Path $_) { Ok $_ } else { Fail "missing $_" }
}

Push-Location services/indexer
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "indexer typecheck" } else { Fail "indexer typecheck" }
Pop-Location

Push-Location pricing-engine
npm install --silent 2>&1 | Out-Null
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "pricing-engine typecheck" } else { Fail "pricing-engine typecheck" }
Pop-Location

& "$PSScriptRoot\bootstrap-mobile-env.ps1" -Network testnet 2>&1 | Out-Null
if (Test-Path "mobile/x_market_flutter/lib/src/sui_config.dart") { Ok "mobile sui_config generated" }

if ($failed -gt 0) { Write-Host "P3: $failed issue(s)" -ForegroundColor Red; exit 1 }
Write-Host "P3 readiness: pass" -ForegroundColor Green
