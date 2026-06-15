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

# Indexer 健康与数据就绪检查
param(
  [string]$IndexerUrl = "http://localhost:8800"
)

$ErrorActionPreference = "Stop"

try {
  $health = Invoke-RestMethod -Uri "$IndexerUrl/health" -TimeoutSec 15
  if (-not $health.ok) { throw "health not ok" }
  Write-Host "[OK] indexer $IndexerUrl" -ForegroundColor Green
  Write-Host "     $($health | ConvertTo-Json -Compress)"
} catch {
  Write-Host "[FAIL] indexer $IndexerUrl — $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Log: .run/indexer.log"
  exit 1
}

foreach ($ep in @("/v1/markets", "/v1/feeds", "/v1/prophet/leaderboard")) {
  try {
    $r = Invoke-RestMethod -Uri "$IndexerUrl$ep" -TimeoutSec 15
    Write-Host "[OK] GET $ep" -ForegroundColor Green
  } catch {
    Write-Host "[WARN] GET $ep — $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
exit 0
