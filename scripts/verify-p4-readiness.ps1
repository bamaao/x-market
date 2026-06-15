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

# P4 SuiProphet 规模化就绪检查
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$failed = 0

function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:failed++ }
function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }

Write-Host "=== P4 Readiness ===" -ForegroundColor Cyan

@(
  "services/prophet-audit-keeper/src/keeper.ts",
  "services/indexer/migrations/003_p4.sql",
  "services/indexer/src/workers/event-roots.ts",
  "services/indexer/src/workers/gmv.ts",
  "app/src/app/metrics/page.tsx",
  "docs/p4-scale-runbook.md"
) | ForEach-Object {
  if (Test-Path $_) { Ok $_ } else { Fail "missing $_" }
}

Push-Location services/prophet-audit-keeper
npm install --silent 2>&1 | Out-Null
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "prophet-audit-keeper typecheck" } else { Fail "prophet-audit-keeper typecheck" }
Pop-Location

Push-Location services/indexer
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "indexer typecheck" } else { Fail "indexer typecheck" }
Pop-Location

$prophetPage = Get-Content "app/src/app/prophet/page.tsx" -Raw
if ($prophetPage -match "discoverPropheciesForPoolWithIndexer" -and $prophetPage -match "decryptFromIndexerCache") {
  Ok "prophet page indexer integration"
} else {
  Fail "prophet page indexer integration"
}

if ($failed -gt 0) { Write-Host "P4: $failed issue(s)" -ForegroundColor Red; exit 1 }
Write-Host "P4 readiness: pass" -ForegroundColor Green
